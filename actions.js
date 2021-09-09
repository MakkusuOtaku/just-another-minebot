const mcdata = require("minecraft-data")('1.16.4');
const Item = require('prismarine-item')('1.16.4');
const pathfinder = require("./pathfinder.js");
const vec3 = require('vec3');
const mcfinder = require('./mc-finder.js');
const fs = require('fs');

const tools = fs.readFileSync('tool-list.txt', 'utf8').split('\r\n');;

function sleep(time) {
    return new Promise(resolve=>setTimeout(resolve, time));
}

const pathfind = async (bot, position, range=1, maxLoops=300)=>{
    bot.task.push("pathfind");

    let botPosition = bot.entity.position;
    let path = pathfinder.path(bot, bot.entity.position, position, range, maxLoops);

    while (botPosition.distanceTo(position) > range) {
        path = pathfinder.path(bot, botPosition, position, range, maxLoops);

        if (path.length) {
            pathfinder.walk(bot, path[path.length-1].position);
        }

        await sleep(100);

        botPosition = bot.entity.position;
    }

    bot.clearControlStates();
    bot.task.pop();
};

const clearBlock = async (bot, position)=>{
    bot.task.push("clear block");

    await pathfind(bot, position, 4);

    let block = bot.blockAt(position);

    if (bot.game.gameMode == "survival") {
        let availableTools = bot.inventory.slots.filter((slot)=>{
            if (!slot) return;
            return block.canHarvest(slot.type);
        });

        if (availableTools.length) {
            await bot.equip(availableTools[0].type, 'hand');
        } else if (!block.canHarvest(null)) {
            let tool = tools.find((toolName)=>{
                return block.canHarvest(mcdata.itemsByName[toolName].id);
            });

            if (tool) {
                console.log(`Looks like I need ${tool}.`);
                await getItem(bot, tool);
                await bot.equip(mcdata.itemsByName[tool].id, 'hand');
            } else console.log(`Don't know how to destroy ${block.displayName}.`);
        }
    }

    await bot.dig(block, true);

    bot.task.pop();
};

function checkInventory(bot, itemName) {
    let items = bot.inventory.items();
    return items.filter(item => item.name === itemName).length;
}

const equip = async (bot, item, slot='hand')=>{
    bot.task.push("place block");

    let itemType = mcdata.itemsByName[item].id;

    if (!checkInventory(bot, item)) {
        if (bot.game.gameMode == 'creative') {
            await bot.creative.setInventorySlot(36, new Item(itemType, 1));
        } else {
            console.log("Can't get item.");
        }
    }

    await bot.equip(itemType, slot);
    bot.task.pop();
};

const placeBlock = async (bot, position, type="dirt")=>{
    bot.task.push("place block");

    await pathfind(bot, position, 4);

    await clearBlock(bot, position).catch(console.log);

    await equip(bot, type);

    let referenceBlock = bot.blockAt(position.offset(0, -1, 0), false);
    await bot.placeBlock(referenceBlock, vec3(0, 1, 0)).catch(console.log);

    bot.task.pop();
};

const getItem = async (bot, item)=>{
    bot.task.push("get");

    let sourceBlocks = mcfinder.blocks(item).map(block=>{
        return mcdata.blocksByName[block].id;
    });

    let blocks = bot.findBlocks({
        matching: sourceBlocks
    });

    if (blocks.length) {
        await clearBlock(bot, blocks[0]);

        for (let loops = 0; loops < 10; loops++) {
            let drop = bot.nearestEntity((entity)=>{
                return entity.name == 'item';
            });

            if (drop) {
                await pathfind(bot, drop.position.clone(), 1.5);
            } else {
                console.log("Can't find item.");
                await sleep(200);
            }
        }
    } else {
        let recipes = mcfinder.recipes(bot, item);

        let recipe = recipes[0]; //This needs work.

        if (recipe.inShape) {
            for (row of recipe.inShape) {
                for (item of row) {
                    if (item.id != -1) {
                        await getItem(bot, mcdata.items[item.id].name);
                    }
                }
            }
        } else if (recipe.ingredients) {
            for (item of recipe.ingredients) {
                await getItem(bot, mcdata.items[item.id].name);
            }
        } else {
            console.log(`I don't know how to make ${item}.`);
        }

        let craftingTable = bot.findBlock({
            matching: mcdata.blocksByName.crafting_table.id,
        });;

        await pathfind(bot, craftingTable.position, 2);

        await bot.craft(recipe, 1, craftingTable);
    }

    bot.task.pop();
}

exports.pathfind = pathfind;
exports.clearBlock = clearBlock;
exports.placeBlock = placeBlock;
exports.getItem = getItem;
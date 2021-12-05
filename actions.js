const mcdata = require("minecraft-data")('1.16.4');
const Item = require('prismarine-item')('1.16.4');
const pathfinder = require("./pathfinder.js");
const vec3 = require('vec3');
const mcfinder = require('./mc-finder.js');
const fs = require('fs');

const tools = fs.readFileSync('tool-list.txt', 'utf8').split('\r\n');
const smelting = JSON.parse(fs.readFileSync('smelting.json', 'utf8'));

function sleep(time) {
    return new Promise(resolve=>setTimeout(resolve, time));
}

const pathfind = async (bot, position, range=1, maxLoops=300)=>{
    let tracker = bot.task.length;
    bot.task.push(`pathfind ${range}`);

    if (bot.entity.position.distanceTo(position) <= range) {
        bot.task.pop();
        return;
    }

    let botPosition = bot.entity.position;
    let path = pathfinder.path(bot, bot.entity.position, position, range, maxLoops);

    if (!path.length) {
        await sleep(2000);
        botPosition = bot.entity.position;
        path = pathfinder.path(bot, bot.entity.position, position, range, maxLoops);
    }

    bot.path = {
        path: path,
        goal: position,
        range: range,
        maxLoops: maxLoops,
    };

    let originalLength = path.length;

    while (botPosition.distanceTo(position) > range) {
        path = bot.path.path;
        //path = pathfinder.path(bot, botPosition, position, range, maxLoops);

        bot.task[tracker] = `pathfind ${path.length}/${originalLength} <${range}`;

        if (path.length) {
            let distanceA = botPosition.distanceTo(path[path.length-1].position);

            /*if (path.length >= 2) {
                console.log("Pos B");
                let distanceB = botPosition.distanceTo(path[path.length-2].position);
                if (distanceA > distanceB) bot.path.path.pop();
            }*/

            if (distanceA < 0.5) bot.path.path.pop();
            if (path.length) pathfinder.walk(bot, path[path.length-1].position);
        }

        await sleep(100);

        botPosition = bot.entity.position;
    }

    bot.path = null;
    bot.clearControlStates();
    bot.task.pop();
};

const clearBlock = async (bot, position)=>{
    bot.task.push("clear block");

    await pathfind(bot, position, 2);

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
                await getItem(bot, tool);
                await equip(bot, tool);
            } else console.log(`Don't know how to destroy ${block.displayName}.`);
        }
    }

    await pathfind(bot, position, 2);
    await bot.dig(block, true);

    bot.task.pop();
};

function checkInventory(bot, itemName) {
    let items = bot.inventory.items();
    return items.filter(item => item.name === itemName).length;
};

const equip = async (bot, item, slot='hand')=>{
    bot.task.push(`equip ${item}`);

    let itemType = mcdata.itemsByName[item].id;

    if (!checkInventory(bot, item)) {
        if (bot.game.gameMode == 'creative') {
            await bot.creative.setInventorySlot(36, new Item(itemType, 1));
        } else {
            await getItem(bot, item);
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

    await pathfind(bot, position, 4);

    let referenceBlock = bot.blockAt(position.offset(0, -1, 0), false);
    await bot.placeBlock(referenceBlock, vec3(0, 1, 0)).catch(console.log);

    bot.task.pop();
};

const prepareTable = async (bot, tableType)=>{
    bot.task.push(`prepare ${tableType}`);

    let table = bot.findBlock({
        matching: mcdata.blocksByName[tableType].id,
    });

    let tablePosition;

    if (!table) {
        let blocks = bot.findBlocks({
            maxDistance: 8,
            matching: [mcdata.blocksByName.air.id, mcdata.blocksByName.cave_air.id],
            count: 64,
        });

        console.log(`Found ${blocks.length} air.`);

        let block = blocks.find((b)=>{
            let below = bot.blockAt(b.offset(0, -1, 0));

            for (entity of Object.values(bot.entities)) {
                // This should be improved. I'll do it later.... maybe.
                if (entity.position.distanceTo(b) <= 1) return false;
            }

            return !['air', 'cave_air'].includes(below.name);
        });

        if (block) tablePosition = block;
        else console.log("Couldn't find a place to put the table.");

        await placeBlock(bot, tablePosition, tableType);
    } else {
        tablePosition = table.position;
    }
    
    bot.task.pop();
    return tablePosition;
};

const getItem = async (bot, item)=>{
    bot.task.push(`get ${item}`);

    let sourceBlocks = mcfinder.blocks(item).map(block=>{
        return mcdata.blocksByName[block].id;
    });

    let blocks = bot.findBlocks({
        matching: sourceBlocks,
        point: bot.entity.position.offset(0, bot.entity.height, 0),
    });

    if (blocks.length) {
        await clearBlock(bot, blocks[0]);

        for (let loops = 0; loops < 10; loops++) {
            let drop = bot.nearestEntity((entity)=>{
                return entity.name == 'item';
            });

            if (drop) {
                //await pathfind(bot, drop.position.clone().floor().offset(0.5, 0, 0.5), 1);
                await pathfind(bot, drop.position.clone().floor(), 1);
            }
            await sleep(100);
        }
    } else {
        let recipes = mcfinder.recipes(bot, item);

        if (smelting[item]) {
            await smeltItem(bot, smelting[item].sources[0]);
        } else if (recipes.length) {
            await craftItem(bot, item);
        } else {
            //console.log(`Couldn't find any recipes for ${item}.`);
            await craftItem(bot, item);
        }
    }

    bot.task.pop();
};

const hasIngredients = (bot, ingredients)=>{
    //bot.inventory.count(mcdata.itemsByName[name].id);
    console.log("Checking for ingredients:");

    for (ingredient of ingredients) {
        //let name = mcdata.items[ingredient.id].name;
        //await collectItem(bot, name, -ingredient.count);
        let got = bot.inventory.count(ingredient.id);
        let get = -ingredient.count;

        console.log(`   ${mcdata.items[ingredient.id].name}: ${got}/${get} ${got >= get? '✔︎':'✘'}`);

        if (got < get) return false;
    }

    return true;
};

const craftItem = async (bot, item)=>{
    bot.task.push(`craft ${item}`);

    let recipes = mcfinder.recipes(bot, item, false);
    console.log(`Recipes for ${item}: ${recipes.length}`);

    let usingTable = false;
    let craftingTable;

    if (!recipes.length) {
        usingTable = true;
        console.log("Crafting table required.");

        let tablePosition = await prepareTable(bot, 'crafting_table');
        craftingTable = bot.blockAt(tablePosition);

        recipes = mcfinder.recipes(bot, item, true);
    }

    let recipe = recipes[0]; //This needs work.

    let needs = recipe.delta.filter((ingredient)=>{
        return ingredient.count < 0;
    });


    while (!hasIngredients(bot, needs)) {
        for (ingredient of needs) {
            let name = mcdata.items[ingredient.id].name;
            await collectItem(bot, name, -ingredient.count);
        }
    }

    if (usingTable) {
        await pathfind(bot, craftingTable.position, 2);
        await bot.craft(recipe, 1, craftingTable);
    } else await bot.craft(recipe, 1);

    bot.task.pop();
};

const fuels = ['coal', 'oak_log'];

const smeltItem = async (bot, itemName)=>{
    bot.task.push(`smelt ${itemName}`);

    let item = mcdata.itemsByName[itemName];

    if (!bot.inventory.count(item.id)) {
        await getItem(bot, itemName);
    }

    let fuel = fuels.find((name)=>{
        return bot.inventory.count(mcdata.itemsByName[name].id);
    });

    if (!fuel) {
        await getItem(bot, fuels[0]);
        fuel = fuels[0];
        console.log("Got some fuel.");
    }

    let furnacePosition = await prepareTable(bot, 'furnace');
    let furnaceBlock = bot.blockAt(furnacePosition);

    /*let furnaceBlock = bot.findBlock({
        matching: mcdata.blocksByName.furnace.id,
    });*/

    if (furnaceBlock) {
        await pathfind(bot, furnaceBlock.position, 2);

        let furnace = await bot.openFurnace(furnaceBlock);

        await furnace.putInput(item.id, null, 1);
        await furnace.putFuel(mcdata.itemsByName[fuel].id, null, 1);

        furnace.close();

        while (true) { //This could easily be a problem. ¯\_(ツ)_/¯
            await sleep(2000);
            console.log("Waiting for furnace.");

            let furnace = await bot.openFurnace(furnaceBlock);
            let out = furnace.outputItem();

            if (furnace.outputItem()) {
                await furnace.takeOutput();
                furnace.close();
                break;
            }
            furnace.close();
        }
    }

    bot.task.pop();
};

const collectItem = async (bot, itemName, quantity)=>{
    let tracker = bot.task.length;
    bot.task.push(`collect ${itemName} x${quantity}`);

    let item = mcdata.itemsByName[itemName];
    let deposited = 0; //Keep track of items deposited into chests. (None for now because I haven't added that)
    if (!quantity) quantity = item.stackSize;

    while (bot.inventory.count(item.id)+deposited < quantity) {
        bot.task[tracker] = `collect ${itemName} ${bot.inventory.count(item.id)}/${quantity}`;
        await getItem(bot, itemName);
    }

    bot.task.pop();
};

const clearArea = async (bot, pointA, pointB)=>{
    bot.task.push(`quarry`);

    let minX = Math.min(pointA.x, pointB.x);
    let minY = Math.min(pointA.y, pointB.y);
    let minZ = Math.min(pointA.z, pointB.z);

    let maxX = Math.max(pointA.x, pointB.x);
    let maxY = Math.max(pointA.y, pointB.y);
    let maxZ = Math.max(pointA.z, pointB.z);

    let zD = 1;
    let z = minZ;

    for (let y = maxY; y >= minY; y--) {
        for (let x = minX; x < maxX; x+=4) {
            while (z < maxZ && z > minZ-1) {
                for (xx = 0; xx < 4 && x+xx < maxX; xx++) {
                    let k = x+xx;
                    await clearBlock(bot, vec3(k, y, z));
                }
                z += zD;
            }
            zD = -zD;
            z += zD;
        }
    }

    bot.task.pop();
};

const deposit = async (bot, position, items=[])=>{
    bot.task.push(`deposit`);

    await pathfind(bot, position, 4);

    /*let chestBlock = bot.findBlock({
		matching: mcdata.blocksByName['chest'].id,
		maxDistance: 5,// This should be 2.
        point: position,
	});*/

    let chestBlock = bot.blockAt(position);

    if (chestBlock) {
        await pathfind(bot, chestBlock.position, 2);

        let chest = await bot.openChest(chestBlock);

        await bot.waitForTicks(20);

        console.log(chest.window);

        for (slot of bot.inventory.slots) {
			if (slot) {
                console.log(slot.type);
				await chest.deposit(slot.type, null, slot.count);
                //await chest.deposit(slot.type, null, bot.inventory.count(slot.type));
			}
		}

        chest.close();
    } else {
        console.log(`${bot.username} was unable to find chest.`);
    }

    bot.task.pop();
};

const give = async (bot, username, itemName, quantity)=>{
    bot.task.push(`give ${username} ${itemName} x${quantity}`);

    let player = bot.players[username];
    let itemID = mcdata.itemsByName[itemName].id;

    await collectItem(bot, itemName, quantity);

    await pathfind(bot, player.entity.position, 2.5, 300);

    await bot.toss(itemID, null, quantity);

    bot.task.pop();
};

//This could use a clean.
exports.pathfind = pathfind;
exports.clearBlock = clearBlock;
exports.clearArea = clearArea;
exports.placeBlock = placeBlock;
exports.getItem = getItem;
exports.collectItem = collectItem;
exports.equip = equip;
exports.deposit = deposit;
exports.smelt = smeltItem;
exports.give = give;

exports.pathfinder = pathfinder;
const minecraftData = require('minecraft-data')("1.16.4"); //Keeping this as is for now.
const Recipe = require("prismarine-recipe")("1.16.4").Recipe;

const blockLoot = minecraftData.blockLoot;
const entityLoot = minecraftData.entityLoot;

exports.blocks = (item)=>{
	let results = [];

	for (blockName of Object.keys(blockLoot)) {
		let found = blockLoot[blockName].drops.find((dropped)=>{
			return(dropped.item == item);
		});
		if (found) {
			results.push(blockName);
		}
	}
	return(results);
};

exports.mobs = (item)=>{
	let results = [];

	for (entityName of Object.keys(entityLoot)) {
		let found = entityLoot[entityName].drops.find((dropped)=>{
			return(dropped.item == item);
		});
		if (found) {
			results.push(entityName);
		}
	}
	return(results);
};

exports.recipes = (bot, item)=>{
	let itemID = minecraftData.itemsByName[item].id;
	let craftingTable = bot.findBlock({
        matching: minecraftData.blocksByName.crafting_table.id,
    });;

	let repices = bot.recipesAll(itemID, null, craftingTable);
	return repices;
};
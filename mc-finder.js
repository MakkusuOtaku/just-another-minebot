const mcdata = require('minecraft-data')("1.16.4"); //Keeping this as is for now.
const Recipe = require("prismarine-recipe")("1.16.4").Recipe;

const blockLoot = mcdata.blockLoot;
const entityLoot = mcdata.entityLoot;

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

exports.recipes = (bot, itemName, useTable=true)=>{
	let item = mcdata.itemsByName[itemName];
	if (item) {
		if (useTable) {
			let craftingTable = bot.findBlock({
				matching: mcdata.blocksByName.crafting_table.id,
			});;
		
			let repices = bot.recipesAll(item.id, null, craftingTable);
			return repices;
		} else {
			let repices = bot.recipesAll(item.id, null);
			return repices;
		}
	} else {
		return [];
	}
};
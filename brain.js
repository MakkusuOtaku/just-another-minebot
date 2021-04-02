const minecraftData = require('minecraft-data')("1.16.4");

const blockLoot = minecraftData.blockLoot;
const entityLoot = minecraftData.entityLoot;

exports.searchBlocks = (item)=>{
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
}

exports.searchMobs = (item)=>{
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
}

const mineflayer = require('mineflayer');
const vec3 = require('vec3');
const {pathfinder, Movements, goals} = require('mineflayer-pathfinder');

var goal = {
	blocks: [iron],
	mobs: [],
	literally: [],
};

var target;
var task = 'idle';
var dropoff= '1568,167,-167';
var mcData;

const brain = require('./brain.js');

const bot = mineflayer.createBot({
	host: "KingMazer.aternos.me",
	username: "Linn",
	version: "1.19",
	viewDistance: "tiny",
});

bot.loadPlugin(pathfinder);

bot.on('kicked', (reason, loggedIn) => console.log(reason, loggedIn));
bot.on('error', err => console.log(err));

bot.once('spawn', ()=>{
	mcData = require('minecraft-data')(bot.version);
	movement = new Movements(bot, mcData);
	bot.pathfinder.setMovements(movement);
});

var busy;
var start = ()=>{busy = false;}
var stop = ()=>{busy = true;}

function goto(position, proximity=1) {
	stop();
	bot.pathfinder.setGoal(new goals.GoalNear(position.x, position.y, position.z, proximity));
}

function chat(username, message) {
	if (username == bot.username) return;
	let player = bot.players[username];
	let tokens = message.split(' ');

	switch (tokens[0]) {
		case 'deposit':
			task = 'deposit';
			if (tokens[1]) {
				depositPlace = vec3(parseInt(tokens[1]), parseInt(tokens[2]), parseInt(tokens[3]));
				goto(depositPlace, 4);
			} else {
				deposit();
			}
			break;
		case 'collect':
			goal.blocks = [];
			goal.mobs = [];
			goal.literally = [];
			for (option of tokens[1].split(',')) {
				goal.blocks.push(...brain.searchBlocks(option));
				goal.mobs.push(...brain.searchMobs(option));
				goal.literally.push(option);
			}
			bot.whisper(username, `Blocks:    ${goal.blocks.join(', ')}`);
			bot.whisper(username, `Mobs:    ${goal.mobs.join(', ')}`);
			break;
		case 'dropoff':
			dropoff = vec3(parseInt(tokens[1]), parseInt(tokens[2]), parseInt(tokens[3]));
			bot.whisper(username, "Dropoff point set.");
			break;
		case 'huntfor':
			for (option of tokens[1].split(',')) {
				goal.mobs.push(...brain.searchMobs(option));
			}
			goal.blocks = [];
			break;
		case 'list':
			console.log(bot.inventory);
			bot.whisper(username, bot.inventory.slots.join(', ')); //This doesn't work & I'm too lazy to fix it.
			break;
		case 'minefor':
			for (option of tokens[1].split(',')) {
				goal.blocks.push(...brain.searchBlocks(option));
			}
			goal.mobs = [];
			break;
		case 'source':
			let blocks = brain.searchBlocks(tokens[1]);
			let mobs = brain.searchMobs(tokens[1]);
			bot.whisper(username, `
				Mobs:    ${mobs.join(', ')}
				Blocks:  ${blocks.join(', ')}
			`);
			break;
	}
}

bot.on('chat', chat);
bot.on('whisper', chat);

function getTarget() {
	let blockTarget = bot.findBlock({
		matching: (blk)=>{
			return(goal.blocks.includes(blk.name));
		}
	});
	let entityTarget = bot.nearestEntity((entity)=>{
		return(goal.mobs.includes(entity.name));
	});

	if (blockTarget && entityTarget) {
		let blockDistance = bot.entity.position.distanceTo(blockTarget.position);
		let entityDistance = bot.entity.position.distanceTo(entityTarget.position);

		return(blockDistance < entityDistance? blockTarget : entityTarget);
	} else {
		if (entityTarget) return(entityTarget);
		if (blockTarget) return(blockTarget);
	}
}

function doSomething() {
	if (busy) return;

	if (target && bot.entity.position.distanceTo(target.position) < 4) {
		if (target.constructor.name == 'Block') {
			stop();
			bot.dig(target, ()=>{
				target = null;
				start();
			});
		} else {
			bot.attack(target);
		}
	} else {
		target = getTarget();
		if (target) goto(target.position, 3);
	}
}

bot.on('move', ()=>{
	if (busy) return;

	if (bot.inventory.slots.filter(v=>v==null).length < 11) {
		task = 'deposit';
	}

	if (task == 'deposit') {
		deposit();
	} else {
		doSomething();
	}
});

bot.on('entityGone', (entity)=>{
	if (entity != target) return;
	target = 0;
	bot.pathfinder.setGoal(null);
});

bot.on('goal_reached', start);

async function deposit() {
	let chestBlock = bot.findBlock({
		matching: mcData.blocksByName['chest'].id,
		maxDistance: 5,
	});

	if (!chestBlock) {
		goto(chest.dropoff, 4);
	} else {
		let chest = await bot.openChest(chestBlock);

		for (slot of bot.inventory.slots) {
			if (slot && goal.literally.includes(slot.name)) {
				await chest.deposit(slot.type, null, slot.count);
			}
		}
		chest.close();
		task = 'idle';
	}
}

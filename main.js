const mineflayer = require("mineflayer");
const actions = require("./actions.js");
const fs = require('fs');
const vec3 = require('vec3');

const settings = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
const mcdata = require("minecraft-data")('1.16.4');

const bots = [];
const structures = [];
const commands = [];

var lastJoin = new Date();
var spawning = false;

function createBot() {
    spawning = true;

    let bot = mineflayer.createBot({
        username: `TestMachine_${bots.length}`,
        server: "localhost",
        version: "1.16.4",
		port: 50017,
    });
    
    bot.task = [];
	bot.todo = [];

    bot.once("spawn", ()=>{
        spawning = false;
        lastJoin = new Date();
    });

	bot.on('kicked', (reason, loggedIn)=>console.log(reason, loggedIn));
	bot.on('error', err=>console.log(err));

	let updatePath = ()=>{
		if (!bot.path || !bot.path.path.length) return;

		//let start = bot.path.path[bot.path.path.length-1].position;
		let start = bot.entity.position;
		let end = bot.path.goal;

		bot.path.path = actions.pathfinder.path(bot, start, end, bot.path.range, bot.path.maxLoops);
	};

	bot.on('blockUpdate', updatePath);
	bot.on('chunkColumnLoad', updatePath);
	setInterval(updatePath, 2000);

    bots.push(bot);
}

function processCommand(username, message) {
    if (!settings.bosses.includes(username)) return;

    let tokens = message.split(' ');

	if (tokens[0].startsWith('@')) {
		let bot = bots.find((bot)=>{
			return bot.username == tokens[0].slice(1);
		});

		tokens.shift();

		if (bot) {
			if (bot.task.length) {
				bot.chat(`I'm busy. I'll do it later.`);
				bot.todo.push(tokens);
			} else {
				runCommand(bot, tokens);
			}
		} else {
			bots[0].chat("Couldn't find the specified bot.");
		}
	} else {
		let bot = bots.find((bot)=>{
			return !bot.task.length;
		});

		if (bot) {
			runCommand(bot, tokens);
		} else {
			bots[0].chat("Everyone is busy. Adding the command to list.");
			commands.push(tokens);
		}
	}
}

/*
	The comments in the following function are only reminders to myself of all the things I haven't added.
	Please keep that in mind.
*/

function runCommand(bot, tokens) {
	switch (tokens[0]) {
		case 'break':
			actions.clearBlock(bot, vec3(
				parseInt(tokens[1]),
				parseInt(tokens[2]),
				parseInt(tokens[3]),
			));
			break;
		case 'collect':
			// Get a type of item by both mining and hunting on loop.
			// Can also include stopping criteria.

			actions.collectItem(bot, tokens[1], parseInt(tokens[2]));
			break;
		case 'come':
			actions.pathfind(bot, bot.players["Makkusu_Otaku"].entity.position, 2.5, 300);
			break;
		case 'deposit':
			//Deposit items into chest at position.
			//Can also include the type of item to deposit.
			//If no position is specified it'll use the default. (dropoff location)

			let location = vec3(parseInt(tokens[1]), parseInt(tokens[2]), parseInt(tokens[3]));

			//Or just use default location.
			actions.deposit(bot, location);
			break;
		case 'dropoff':
			//Sets the position of the chest used to deposit items when inventory is full.
			break;
		case 'equip':
			actions.equip(bot, tokens[1]);
			break;
		case 'get':
			//Get the specified item.
			actions.getItem(bot, tokens[1]);
			break;
		case 'give':
			actions.give(
				bot,
				tokens[1],
				tokens[2],
				parseInt(tokens[3] || '1')
			);
			break;
		case 'goto':
			//Go to specified position.
			actions.pathfind(bot, vec3(
				parseInt(tokens[1]),
				parseInt(tokens[2]),
				parseInt(tokens[3]),
			), 1);
			break;
		case 'hunt':
			//Hunt for a single item.
			break;
		case 'mine':
			//Mine for a single item.
			break;
		case 'minefor':
			//Go mining for a type of item on loop.
			//Can also include stopping criteria.
			break;
		case 'quarry':
			//Dig a quarry between points A & B.
			let pointA = vec3(
				parseInt(tokens[1]),
				parseInt(tokens[2]),
				parseInt(tokens[3]),
			);
			let pointB = vec3(
				parseInt(tokens[4]),
				parseInt(tokens[5]),
				parseInt(tokens[6]),
			);
			actions.clearArea(bot, pointA, pointB);
			break;
		case 'smelt':
			actions.smelt(bot, tokens[1]);
			break;
		case 'source':
			//Tells you the sources of an item.
			break;
	}
}

async function cosmicLooper() {
    let time = new Date();

    if (!spawning && bots.length < settings.maxBots && (time-lastJoin) > settings.spawnDelay) {
        createBot();
    }

	for (bot of bots) {
		if (!bot.task.length) {
			if (bot.todo.length) {
				runCommand(bot, bot.todo[0]);
				bot.todo.shift();
			} else if (commands.length) {
				runCommand(bot, commands[0]);
				commands.shift();
			}
		}
	}

    if (bots.length) {
        console.clear();
        for (bot of bots) {
            console.log(`${bot.username}:  ${bot.task.join(' > ')}`);
        }
    }
    setTimeout(cosmicLooper, 100);
}

createBot();

bots[0].once("spawn", ()=>{
    let bot = bots[0];

    bot.on("chat", processCommand);
	bot.on('whisper', processCommand);
    cosmicLooper();
});

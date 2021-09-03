const mineflayer = require("mineflayer");
const actions = require("./actions.js");
const fs = require('fs');

const settings = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));

const bots = [];
const structures = [];
const commands = [];

var lastJoin = new Date();
var spawning = false;

function createBot() {
    spawning = true;

    let bot = mineflayer.createBot({
        username: `Machine_${bots.length}`,
        server: "localhost",
        version: "1.16.4",
        port: 62402,
    });
    
    bot.task = [];
	bot.todo = [];

    bot.once("spawn", ()=>{
        spawning = false;
        lastJoin = new Date();
    });

	bot.on('kicked', (reason, loggedIn)=>console.log(reason, loggedIn));
	bot.on('error', err=>console.log(err));

    bots.push(bot);
}

function processCommand(username, message) {
    if (username !== "Makkusu_Otaku") return;

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

function runCommand(bot, tokens) {
	switch (tokens[0]) {
		case 'break':
			actions.clearBlock(bot, vec3(
				parseInt(tokens[1]),
				parseInt(tokens[2]),
				parseInt(tokens[3]),
			));
			break;
		case 'find':
			actions.getItem(bot, tokens[1]);
			break;
		case 'come':
			actions.pathfind(bot, bot.players["Makkusu_Otaku"].entity.position, 2.5, 50);
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

    if (bots.length && 0) {
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

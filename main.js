const mineflayer = require("mineflayer");
const buildings = require("./generate-buildings.js");
const actions = require("./bot-actions.js");

const spawnDelay = 2000;
const maxBots = 1;
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
        port: 54872,
    });
    
    bot.task = [];

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

    let bot = bots.find((bot)=>{
        return !bot.task.length;
    });

    if (bot) {
        //actions.pathfind(bot, bot.players["Makkusu_Otaku"].entity.position);
        actions.placeBlock(bot, bot.players["Makkusu_Otaku"].entity.position.clone(), "cobblestone");
    } else {
        bots[0].chat("Everyone is busy.");
        commands.push(tokens);
    }
}

async function cosmicLooper() {
    let time = new Date();

    if (!spawning && bots.length < maxBots && (time-lastJoin) > spawnDelay) {
        createBot();
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
structures.push(buildings.stage());

bots[0].once("spawn", ()=>{
    let bot = bots[0];

    bot.on("chat", processCommand);
	bot.on('whisper', processCommand);
    cosmicLooper();
});

/*
    This is a work in progress and isn't very reliable.
    I'm putting it in here for testing.
*/

const vec3 = require('vec3');

function neighbours(bot, p) {
    let points = [
        p.offset( 0, 0,-1),
        p.offset( 0, 0, 1),
        p.offset(-1, 0, 0),
        p.offset( 1, 0, 0),
    ];

    for (i in points) {
        if (!clean(bot, points[i])) {
            points[i] = points[i].offset(0, 1, 0);
        } else if (clean(bot, points[i], 0,-1, 0)) {
            points[i] = points[i].offset(0,-1, 0);
        }
    }

    return points.filter((n)=>{
        let block = bot.blockAt(n.offset(0, -1, 0));
        let height = block && block.shapes.length? block.shapes[0][4] : 1;
        
        return height <= 1 && !clean(bot, n, 0,-1, 0) && clean(bot, n, 0, 0, 0) && clean(bot, n, 0, 1, 0);
    });
}

function clean(bot, n, x=0, y=0, z=0) {
    let b = bot.blockAt(n.offset(x, y, z));
    return b && (b.displayName.includes('Air') || b.material == 'plant');
}

function gridWalk(bot, goal) {
    let botPos = bot.entity.position;

    goal = goal.offset(
        -bot.entity.position.x,
        -bot.entity.position.y,
        -bot.entity.position.z
    );

    if (goal && botPos.distanceTo(botPos.offset(goal.x, goal.y, goal.z)) >= 0.1) {
        bot.lookAt(botPos.offset(goal.x, 1.8, goal.z), true);
        bot.setControlState('forward', true);
        bot.setControlState('sprint', true);
        bot.setControlState('jump', goal.y > 0);
    } else {
        bot.setControlState('forward', false);
        bot.setControlState('sprint', false);
        bot.setControlState('jump', false);
    }
}

function pathfind(bot, start, end, range=1, maxLoops=100) {
    let openList = [];
    let closedList = [];
    let initDist = start.distanceTo(end);
    let loops = 0;

    start = vec3(
        Math.floor(start.x)+0.5,
        Math.floor(start.y),
        Math.floor(start.z)+0.5
    );

    openList.push({
        position: start,
        g: 0,
        h: initDist,
        f: 0,
    });

    while (openList.length && loops < maxLoops) {
        loops++;
        let point = openList.reduce((p, c)=>{
            return p.f < c.f ? p : c;
        });
    
        openList.splice(openList.indexOf(point), 1);
        closedList.push(point);
        
        if (point.position.distanceTo(end) < range) {
            let path = [];
            while (point.root) {
                path.push(point);
                point = point.root;
            }
            return path;
        }

        for (neighbour of neighbours(bot, point.position)) {
            let onClosedList = closedList.find((obj)=>{
                return obj.position.distanceTo(neighbour) < 0.1;
            });

            if (!onClosedList) {
                let g = point.g+1;
                let h = neighbour.distanceTo(end);
                let f = g+h;

                let babyPoint = {
                    position: neighbour,
                    g: g,
                    h: h,
                    f: f,
                    root: point,
                };

                let previous = openList.find((obj)=>{
                    return obj.position.distanceTo(neighbour) < 0.1;
                });

                if (previous) {
                    if (g < previous.g) {
                        openList.splice(openList.indexOf(previous), 1);
                        openList.push(babyPoint);
                    }
                } else {
                    openList.push(babyPoint);
                }
            }
        }
    }
    if (openList.length) {
        let point = openList.reduce((p, c)=>{
            return p.f < c.f ? p : c;
        });
        let path = [];
        while (point.root) {
            path.push(point);
            point = point.root;
        }
        return path;
    }

    return [];
}

exports.path = pathfind;
exports.walk = gridWalk;
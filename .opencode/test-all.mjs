import { generateCommand } from './lib/generate.js';
import { feedbackOnCommand } from './lib/feedback.js';

// Test 1: Various explosion counts
console.log("=== Test: explosion count balance ===");
for (let n = 1; n <= 5; n++) {
    const explosions = Array(n).fill(null).map((_, i) => ({
        shape: ['star','large_ball','burst','creeper','small_ball'][i],
        colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF']
    })).slice(0, n);
    const res = generateCommand({position:'player', flight_duration: 2, explosions});
    let bal = 0;
    for (const c of res.command) { if(c==='{')bal++; if(c==='}')bal--; }
    console.log(`N=${n} balance=${bal} ends=${JSON.stringify(res.command.slice(-6))}`);
}

// Test 2: With fade_colors, has_trail, has_twinkle
console.log("\n=== Test: with effects ===");
const r2 = generateCommand({
    position: 'player_head',
    flight_duration: 3,
    shot_at_angle: true,
    explosions: [
        { shape: 'star', colors: ['#FF0000'], fade_colors: ['#0000FF'], has_trail: true, has_twinkle: true }
    ]
});
let bal2 = 0; for(const c of r2.command){if(c==='{')bal2++;if(c==='}')bal2--;}
console.log(`balance=${bal2} ends=${JSON.stringify(r2.command.slice(-8))}`);

// Test 3: All position presets
console.log("\n=== Test: all positions ===");
const positions = ['here','player','player_head','player_forward','player_eyes_forward','all_players'];
positions.forEach(pos => {
    try {
        let p = { position: pos, flight_duration: 1, explosions: [{shape:'star',colors:['#FF0000']}] };
        if (pos.includes('forward')) p.distance = 3;
        const res = generateCommand(p);
        let b = 0; for(const c of res.command){if(c==='{')b++;if(c==='}')b--;}
        console.log(`${pos}: balance=${b} ends=${JSON.stringify(res.command.slice(-5))}`);
    } catch(e) { console.log(`${pos}: error - ${e.message}`); }
});

// Test 4: MCFunction format
console.log("\n=== Test: mcfunction format ===");
const r4 = generateCommand({position:'player',flight_duration:2,explosions:[{shape:'star',colors:['#FF0000']}],format:'mcfunction'});
let bal4 = 0; for(const c of r4.command){if(c==='{')bal4++;if(c==='}')bal4--;}
console.log(`balance=${bal4} starts_with_slash=${r4.command.startsWith('/')}`);

// Test 5: NBT format
console.log("\n=== Test: nbt format ===");
const r5 = generateCommand({position:'player',flight_duration:2,explosions:[{shape:'star',colors:['#FF0000']}],format:'nbt'});
let bal5 = 0; for(const c of r5.command){if(c==='{')bal5++;if(c==='}')bal5--;}
console.log(`balance=${bal5} starts_with_slash=${r5.command.startsWith('/')}`);

// Test 6: Feedback tool (corrected command)
console.log("\n=== Test: feedback corrected_command ===");
const fb = feedbackOnCommand({command: r2.command, suggest_fix: true});
if (fb.corrected_command) {
    let bal6 = 0; for(const c of fb.corrected_command){if(c==='{')bal6++;if(c==='}')bal6--;}
    console.log(`corrected balance=${bal6} ends=${JSON.stringify(fb.corrected_command.slice(-6))}`);
} else {
    console.log('no correction generated');
}

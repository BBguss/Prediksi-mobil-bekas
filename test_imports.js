import * as motionReact from 'motion/react';

console.log('Keys of motion/react:');
console.log(Object.keys(motionReact).filter(k => k.includes('Scroll') || k.includes('Transform') || k.includes('Event') || k.includes('motion')));

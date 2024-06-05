//taken from https://github.com/kurkle/chartjs-plugin-autocolors

import {hsv2rgb, rgbString} from '@kurkle/color';

function* hueGen() {
    yield 0;
    while (true) {
        for (let i = 1; i < 10; i++) {
            const d = 1 << i;
            for (let j = 1; j <= d; j += 2) {
                yield j / d;
            }
        }
    }
}

function* colorGen(repeat = 1) {
    const hue = hueGen();
    let h = hue.next();
    while (!h.done) {
        let rgb = hsv2rgb(Math.round((h.value as number) * 360), 0.6, 0.8);
        for (let i = 0; i < repeat; i++) {
            yield {background: rgbString({r: rgb[0], g: rgb[1], b: rgb[2], a: 192}), border: rgbString({r: rgb[0], g: rgb[1], b: rgb[2], a: 144})};
        }
        rgb = hsv2rgb(Math.round((h.value as number) * 360), 0.6, 0.5);
        for (let i = 0; i < repeat; i++) {
            yield {background: rgbString({r: rgb[0], g: rgb[1], b: rgb[2], a: 192}), border: rgbString({r: rgb[0], g: rgb[1], b: rgb[2], a: 144})};
        }
        h = hue.next();
    }
}
function getNext(color, customize, context) {
    const c = color.next().value;
    if (typeof customize === 'function') {
        return customize(Object.assign({colors: c}, context));
    }
    return c;
}

export default (colorNum)=>{
    const gen = colorGen();
    const colors = [];
    while(colors.length<colorNum){
        const c = getNext(gen, null, {chart: null, datasetIndex: 0});
        colors.push(c.background);
    }
    return colors;
};

/**
 * 静态图转 GIF 工具 Pro — 从独立 HTML 迁移而来
 * AI 动画生成改走 ops-assistant 后端代理(/api/gif-maker/ai-animation),复用用户配置的 Kimi/DeepSeek/OpenAI 等
 */
export function mount(root) {
  // 等 gif.js 库加载完再启动
  function go() {
// ═══════════════════════════════════════════════════════════
//  gif.js Worker 内嵌
// ═══════════════════════════════════════════════════════════
const WORKER_CODE = `(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){var NeuQuant=require("./TypedNeuQuant.js");var LZWEncoder=require("./LZWEncoder.js");function ByteArray(){this.page=-1;this.pages=[];this.newPage()}ByteArray.pageSize=4096;ByteArray.charMap={};for(var i=0;i<256;i++)ByteArray.charMap[i]=String.fromCharCode(i);ByteArray.prototype.newPage=function(){this.pages[++this.page]=new Uint8Array(ByteArray.pageSize);this.cursor=0};ByteArray.prototype.getData=function(){var rv="";for(var p=0;p<this.pages.length;p++){for(var i=0;i<ByteArray.pageSize;i++){rv+=ByteArray.charMap[this.pages[p][i]]}}return rv};ByteArray.prototype.writeByte=function(val){if(this.cursor>=ByteArray.pageSize)this.newPage();this.pages[this.page][this.cursor++]=val};ByteArray.prototype.writeUTFBytes=function(string){for(var l=string.length,i=0;i<l;i++)this.writeByte(string.charCodeAt(i))};ByteArray.prototype.writeBytes=function(array,offset,length){for(var l=length||array.length,i=offset||0;i<l;i++)this.writeByte(array[i])};function GIFEncoder(width,height){this.width=~~width;this.height=~~height;this.transparent=null;this.transIndex=0;this.repeat=-1;this.delay=0;this.image=null;this.pixels=null;this.indexedPixels=null;this.colorDepth=null;this.colorTab=null;this.neuQuant=null;this.usedEntry=new Array;this.palSize=7;this.dispose=-1;this.firstFrame=true;this.sample=10;this.dither=false;this.globalPalette=false;this.out=new ByteArray}GIFEncoder.prototype.setDelay=function(milliseconds){this.delay=Math.round(milliseconds/10)};GIFEncoder.prototype.setFrameRate=function(fps){this.delay=Math.round(100/fps)};GIFEncoder.prototype.setDispose=function(disposalCode){if(disposalCode>=0)this.dispose=disposalCode};GIFEncoder.prototype.setRepeat=function(repeat){this.repeat=repeat};GIFEncoder.prototype.setTransparent=function(color){this.transparent=color};GIFEncoder.prototype.addFrame=function(imageData){this.image=imageData;this.colorTab=this.globalPalette&&this.globalPalette.slice?this.globalPalette:null;this.getImagePixels();this.analyzePixels();if(this.globalPalette===true)this.globalPalette=this.colorTab;if(this.firstFrame){this.writeLSD();this.writePalette();if(this.repeat>=0){this.writeNetscapeExt()}}this.writeGraphicCtrlExt();this.writeImageDesc();if(!this.firstFrame&&!this.globalPalette)this.writePalette();this.writePixels();this.firstFrame=false};GIFEncoder.prototype.finish=function(){this.out.writeByte(59)};GIFEncoder.prototype.setQuality=function(quality){if(quality<1)quality=1;this.sample=quality};GIFEncoder.prototype.setDither=function(dither){if(dither===true)dither="FloydSteinberg";this.dither=dither};GIFEncoder.prototype.setGlobalPalette=function(palette){this.globalPalette=palette};GIFEncoder.prototype.getGlobalPalette=function(){return this.globalPalette&&this.globalPalette.slice&&this.globalPalette.slice(0)||this.globalPalette};GIFEncoder.prototype.writeHeader=function(){this.out.writeUTFBytes("GIF89a")};GIFEncoder.prototype.analyzePixels=function(){if(!this.colorTab){this.neuQuant=new NeuQuant(this.pixels,this.sample);this.neuQuant.buildColormap();this.colorTab=this.neuQuant.getColormap()}if(this.dither){this.ditherPixels(this.dither.replace("-serpentine",""),this.dither.match(/-serpentine/)!==null)}else{this.indexPixels()}this.pixels=null;this.colorDepth=8;this.palSize=7;if(this.transparent!==null){this.transIndex=this.findClosest(this.transparent,true)}};GIFEncoder.prototype.indexPixels=function(imgq){var nPix=this.pixels.length/3;this.indexedPixels=new Uint8Array(nPix);var k=0;for(var j=0;j<nPix;j++){var index=this.findClosestRGB(this.pixels[k++]&255,this.pixels[k++]&255,this.pixels[k++]&255);this.usedEntry[index]=true;this.indexedPixels[j]=index}};GIFEncoder.prototype.ditherPixels=function(kernel,serpentine){var kernels={FalseFloydSteinberg:[[3/8,1,0],[3/8,0,1],[2/8,1,1]],FloydSteinberg:[[7/16,1,0],[3/16,-1,1],[5/16,0,1],[1/16,1,1]],Stucki:[[8/42,1,0],[4/42,2,0],[2/42,-2,1],[4/42,-1,1],[8/42,0,1],[4/42,1,1],[2/42,2,1],[1/42,-2,2],[2/42,-1,2],[4/42,0,2],[2/42,1,2],[1/42,2,2]],Atkinson:[[1/8,1,0],[1/8,2,0],[1/8,-1,1],[1/8,0,1],[1/8,1,1],[1/8,0,2]]};if(!kernel||!kernels[kernel]){throw"Unknown dithering kernel: "+kernel}var ds=kernels[kernel];var index=0,height=this.height,width=this.width,data=this.pixels;var direction=serpentine?-1:1;this.indexedPixels=new Uint8Array(this.pixels.length/3);for(var y=0;y<height;y++){if(serpentine)direction=direction*-1;for(var x=direction==1?0:width-1,xend=direction==1?width:0;x!==xend;x+=direction){index=y*width+x;var idx=index*3;var r1=data[idx];var g1=data[idx+1];var b1=data[idx+2];idx=this.findClosestRGB(r1,g1,b1);this.usedEntry[idx]=true;this.indexedPixels[index]=idx;idx*=3;var r2=this.colorTab[idx];var g2=this.colorTab[idx+1];var b2=this.colorTab[idx+2];var er=r1-r2;var eg=g1-g2;var eb=b1-b2;for(var i=direction==1?0:ds.length-1,end=direction==1?ds.length:0;i!==end;i+=direction){var x1=ds[i][1];var y1=ds[i][2];if(x1+x>=0&&x1+x<width&&y1+y>=0&&y1+y<height){var d=ds[i][0];idx=index+x1+y1*width;idx*=3;data[idx]=Math.max(0,Math.min(255,data[idx]+er*d));data[idx+1]=Math.max(0,Math.min(255,data[idx+1]+eg*d));data[idx+2]=Math.max(0,Math.min(255,data[idx+2]+eb*d))}}}}};GIFEncoder.prototype.findClosest=function(c,used){return this.findClosestRGB((c&16711680)>>16,(c&65280)>>8,c&255,used)};GIFEncoder.prototype.findClosestRGB=function(r,g,b,used){if(this.colorTab===null)return-1;if(this.neuQuant&&!used){return this.neuQuant.lookupRGB(r,g,b)}var c=b|g<<8|r<<16;var minpos=0;var dmin=256*256*256;var len=this.colorTab.length;for(var i=0,index=0;i<len;index++){var dr=r-(this.colorTab[i++]&255);var dg=g-(this.colorTab[i++]&255);var db=b-(this.colorTab[i++]&255);var d=dr*dr+dg*dg+db*db;if((!used||this.usedEntry[index])&&d<dmin){dmin=d;minpos=index}}return minpos};GIFEncoder.prototype.getImagePixels=function(){var w=this.width;var h=this.height;this.pixels=new Uint8Array(w*h*3);var data=this.image;var srcPos=0;var count=0;for(var i=0;i<h;i++){for(var j=0;j<w;j++){this.pixels[count++]=data[srcPos++];this.pixels[count++]=data[srcPos++];this.pixels[count++]=data[srcPos++];srcPos++}}};GIFEncoder.prototype.writeGraphicCtrlExt=function(){this.out.writeByte(33);this.out.writeByte(249);this.out.writeByte(4);var transp,disp;if(this.transparent===null){transp=0;disp=0}else{transp=1;disp=2}if(this.dispose>=0){disp=dispose&7}disp<<=2;this.out.writeByte(0|disp|0|transp);this.writeShort(this.delay);this.out.writeByte(this.transIndex);this.out.writeByte(0)};GIFEncoder.prototype.writeImageDesc=function(){this.out.writeByte(44);this.writeShort(0);this.writeShort(0);this.writeShort(this.width);this.writeShort(this.height);if(this.firstFrame||this.globalPalette){this.out.writeByte(0)}else{this.out.writeByte(128|0|0|0|this.palSize)}};GIFEncoder.prototype.writeLSD=function(){this.writeShort(this.width);this.writeShort(this.height);this.out.writeByte(128|112|0|this.palSize);this.out.writeByte(0);this.out.writeByte(0)};GIFEncoder.prototype.writeNetscapeExt=function(){this.out.writeByte(33);this.out.writeByte(255);this.out.writeByte(11);this.out.writeUTFBytes("NETSCAPE2.0");this.out.writeByte(3);this.out.writeByte(1);this.writeShort(this.repeat);this.out.writeByte(0)};GIFEncoder.prototype.writePalette=function(){this.out.writeBytes(this.colorTab);var n=3*256-this.colorTab.length;for(var i=0;i<n;i++)this.out.writeByte(0)};GIFEncoder.prototype.writeShort=function(pValue){this.out.writeByte(pValue&255);this.out.writeByte(pValue>>8&255)};GIFEncoder.prototype.writePixels=function(){var enc=new LZWEncoder(this.width,this.height,this.indexedPixels,this.colorDepth);enc.encode(this.out)};GIFEncoder.prototype.stream=function(){return this.out};module.exports=GIFEncoder},{"./LZWEncoder.js":2,"./TypedNeuQuant.js":3}],2:[function(require,module,exports){var EOF=-1;var BITS=12;var HSIZE=5003;var masks=[0,1,3,7,15,31,63,127,255,511,1023,2047,4095,8191,16383,32767,65535];function LZWEncoder(width,height,pixels,colorDepth){var initCodeSize=Math.max(2,colorDepth);var accum=new Uint8Array(256);var htab=new Int32Array(HSIZE);var codetab=new Int32Array(HSIZE);var cur_accum,cur_bits=0;var a_count;var free_ent=0;var maxcode;var clear_flg=false;var g_init_bits,ClearCode,EOFCode;function char_out(c,outs){accum[a_count++]=c;if(a_count>=254)flush_char(outs)}function cl_block(outs){cl_hash(HSIZE);free_ent=ClearCode+2;clear_flg=true;output(ClearCode,outs)}function cl_hash(hsize){for(var i=0;i<hsize;++i)htab[i]=-1}function compress(init_bits,outs){var fcode,c,i,ent,disp,hsize_reg,hshift;g_init_bits=init_bits;clear_flg=false;n_bits=g_init_bits;maxcode=MAXCODE(n_bits);ClearCode=1<<init_bits-1;EOFCode=ClearCode+1;free_ent=ClearCode+2;a_count=0;ent=nextPixel();hshift=0;for(fcode=HSIZE;fcode<65536;fcode*=2)++hshift;hshift=8-hshift;hsize_reg=HSIZE;cl_hash(hsize_reg);output(ClearCode,outs);outer_loop:while((c=nextPixel())!=EOF){fcode=(c<<BITS)+ent;i=c<<hshift^ent;if(htab[i]===fcode){ent=codetab[i];continue}else if(htab[i]>=0){disp=hsize_reg-i;if(i===0)disp=1;do{if((i-=disp)<0)i+=hsize_reg;if(htab[i]===fcode){ent=codetab[i];continue outer_loop}}while(htab[i]>=0)}output(ent,outs);ent=c;if(free_ent<1<<BITS){codetab[i]=free_ent++;htab[i]=fcode}else{cl_block(outs)}}output(ent,outs);output(EOFCode,outs)}function encode(outs){outs.writeByte(initCodeSize);remaining=width*height;curPixel=0;compress(initCodeSize+1,outs);outs.writeByte(0)}function flush_char(outs){if(a_count>0){outs.writeByte(a_count);outs.writeBytes(accum,0,a_count);a_count=0}}function MAXCODE(n_bits){return(1<<n_bits)-1}function nextPixel(){if(remaining===0)return EOF;--remaining;var pix=pixels[curPixel++];return pix&255}function output(code,outs){cur_accum&=masks[cur_bits];if(cur_bits>0)cur_accum|=code<<cur_bits;else cur_accum=code;cur_bits+=n_bits;while(cur_bits>=8){char_out(cur_accum&255,outs);cur_accum>>=8;cur_bits-=8}if(free_ent>maxcode||clear_flg){if(clear_flg){maxcode=MAXCODE(n_bits=g_init_bits);clear_flg=false}else{++n_bits;if(n_bits==BITS)maxcode=1<<BITS;else maxcode=MAXCODE(n_bits)}}if(code==EOFCode){while(cur_bits>0){char_out(cur_accum&255,outs);cur_accum>>=8;cur_bits-=8}flush_char(outs)}}this.encode=encode}module.exports=LZWEncoder},{}],3:[function(require,module,exports){var ncycles=100;var netsize=256;var maxnetpos=netsize-1;var netbiasshift=4;var intbiasshift=16;var intbias=1<<intbiasshift;var gammashift=10;var gamma=1<<gammashift;var betashift=10;var beta=intbias>>betashift;var betagamma=intbias<<gammashift-betashift;var initrad=netsize>>3;var radiusbiasshift=6;var radiusbias=1<<radiusbiasshift;var initradius=initrad*radiusbias;var radiusdec=30;var alphabiasshift=10;var initalpha=1<<alphabiasshift;var alphadec;var radbiasshift=8;var radbias=1<<radbiasshift;var alpharadbshift=alphabiasshift+radbiasshift;var alpharadbias=1<<alpharadbshift;var prime1=499;var prime2=491;var prime3=487;var prime4=503;var minpicturebytes=3*prime4;function NeuQuant(pixels,samplefac){var network;var netindex;var bias;var freq;var radpower;function init(){network=[];netindex=new Int32Array(256);bias=new Int32Array(netsize);freq=new Int32Array(netsize);radpower=new Int32Array(netsize>>3);var i,v;for(i=0;i<netsize;i++){v=(i<<netbiasshift+8)/netsize;network[i]=new Float64Array([v,v,v,0]);freq[i]=intbias/netsize;bias[i]=0}}function unbiasnet(){for(var i=0;i<netsize;i++){network[i][0]>>=netbiasshift;network[i][1]>>=netbiasshift;network[i][2]>>=netbiasshift;network[i][3]=i}}function altersingle(alpha,i,b,g,r){network[i][0]-=alpha*(network[i][0]-b)/initalpha;network[i][1]-=alpha*(network[i][1]-g)/initalpha;network[i][2]-=alpha*(network[i][2]-r)/initalpha}function alterneigh(radius,i,b,g,r){var lo=Math.abs(i-radius);var hi=Math.min(i+radius,netsize);var j=i+1;var k=i-1;var m=1;var p,a;while(j<hi||k>lo){a=radpower[m++];if(j<hi){p=network[j++];p[0]-=a*(p[0]-b)/alpharadbias;p[1]-=a*(p[1]-g)/alpharadbias;p[2]-=a*(p[2]-r)/alpharadbias}if(k>lo){p=network[k--];p[0]-=a*(p[0]-b)/alpharadbias;p[1]-=a*(p[1]-g)/alpharadbias;p[2]-=a*(p[2]-r)/alpharadbias}}}function contest(b,g,r){var bestd=~(1<<31);var bestbiasd=bestd;var bestpos=-1;var bestbiaspos=bestpos;var i,n,dist,biasdist,betafreq;for(i=0;i<netsize;i++){n=network[i];dist=Math.abs(n[0]-b)+Math.abs(n[1]-g)+Math.abs(n[2]-r);if(dist<bestd){bestd=dist;bestpos=i}biasdist=dist-(bias[i]>>intbiasshift-netbiasshift);if(biasdist<bestbiasd){bestbiasd=biasdist;bestbiaspos=i}betafreq=freq[i]>>betashift;freq[i]-=betafreq;bias[i]+=betafreq<<gammashift}freq[bestpos]+=beta;bias[bestpos]-=betagamma;return bestbiaspos}function inxbuild(){var i,j,p,q,smallpos,smallval,previouscol=0,startpos=0;for(i=0;i<netsize;i++){p=network[i];smallpos=i;smallval=p[1];for(j=i+1;j<netsize;j++){q=network[j];if(q[1]<smallval){smallpos=j;smallval=q[1]}}q=network[smallpos];if(i!=smallpos){j=q[0];q[0]=p[0];p[0]=j;j=q[1];q[1]=p[1];p[1]=j;j=q[2];q[2]=p[2];p[2]=j;j=q[3];q[3]=p[3];p[3]=j}if(smallval!=previouscol){netindex[previouscol]=startpos+i>>1;for(j=previouscol+1;j<smallval;j++)netindex[j]=i;previouscol=smallval;startpos=i}}netindex[previouscol]=startpos+maxnetpos>>1;for(j=previouscol+1;j<256;j++)netindex[j]=maxnetpos}function inxsearch(b,g,r){var a,p,dist;var bestd=1e3;var best=-1;var i=netindex[g];var j=i-1;while(i<netsize||j>=0){if(i<netsize){p=network[i];dist=p[1]-g;if(dist>=bestd)i=netsize;else{i++;if(dist<0)dist=-dist;a=p[0]-b;if(a<0)a=-a;dist+=a;if(dist<bestd){a=p[2]-r;if(a<0)a=-a;dist+=a;if(dist<bestd){bestd=dist;best=p[3]}}}}if(j>=0){p=network[j];dist=g-p[1];if(dist>=bestd)j=-1;else{j--;if(dist<0)dist=-dist;a=p[0]-b;if(a<0)a=-a;dist+=a;if(dist<bestd){a=p[2]-r;if(a<0)a=-a;dist+=a;if(dist<bestd){bestd=dist;best=p[3]}}}}}return best}function learn(){var i;var lengthcount=pixels.length;var alphadec=30+(samplefac-1)/3;var samplepixels=lengthcount/(3*samplefac);var delta=~~(samplepixels/ncycles);var alpha=initalpha;var radius=initradius;var rad=radius>>radiusbiasshift;if(rad<=1)rad=0;for(i=0;i<rad;i++)radpower[i]=alpha*((rad*rad-i*i)*radbias/(rad*rad));var step;if(lengthcount<minpicturebytes){samplefac=1;step=3}else if(lengthcount%prime1!==0){step=3*prime1}else if(lengthcount%prime2!==0){step=3*prime2}else if(lengthcount%prime3!==0){step=3*prime3}else{step=3*prime4}var b,g,r,j;var pix=0;i=0;while(i<samplepixels){b=(pixels[pix]&255)<<netbiasshift;g=(pixels[pix+1]&255)<<netbiasshift;r=(pixels[pix+2]&255)<<netbiasshift;j=contest(b,g,r);altersingle(alpha,j,b,g,r);if(rad!==0)alterneigh(rad,j,b,g,r);pix+=step;if(pix>=lengthcount)pix-=lengthcount;i++;if(delta===0)delta=1;if(i%delta===0){alpha-=alpha/alphadec;radius-=radius/radiusdec;rad=radius>>radiusbiasshift;if(rad<=1)rad=0;for(j=0;j<rad;j++)radpower[j]=alpha*((rad*rad-j*j)*radbias/(rad*rad))}}}function buildColormap(){init();learn();unbiasnet();inxbuild()}this.buildColormap=buildColormap;function getColormap(){var map=[];var index=[];for(var i=0;i<netsize;i++)index[network[i][3]]=i;var k=0;for(var l=0;l<netsize;l++){var j=index[l];map[k++]=network[j][0];map[k++]=network[j][1];map[k++]=network[j][2]}return map}this.getColormap=getColormap;this.lookupRGB=inxsearch}module.exports=NeuQuant},{}],4:[function(require,module,exports){var GIFEncoder,renderFrame;GIFEncoder=require("./GIFEncoder.js");renderFrame=function(frame){var encoder,page,stream,transfer;encoder=new GIFEncoder(frame.width,frame.height);if(frame.index===0){encoder.writeHeader()}else{encoder.firstFrame=false}encoder.setTransparent(frame.transparent);encoder.setRepeat(frame.repeat);encoder.setDelay(frame.delay);encoder.setQuality(frame.quality);encoder.setDither(frame.dither);encoder.setGlobalPalette(frame.globalPalette);encoder.addFrame(frame.data);if(frame.last){encoder.finish()}if(frame.globalPalette===true){frame.globalPalette=encoder.getGlobalPalette()}stream=encoder.stream();frame.data=stream.pages;frame.cursor=stream.cursor;frame.pageSize=stream.constructor.pageSize;if(frame.canTransfer){transfer=function(){var i,len,ref,results;ref=frame.data;results=[];for(i=0,len=ref.length;i<len;i++){page=ref[i];results.push(page.buffer)}return results}();return self.postMessage(frame,transfer)}else{return self.postMessage(frame)}};self.onmessage=function(event){return renderFrame(event.data)}},{"./GIFEncoder.js":1}]},{},[4]);`;
const WORKER_URL = URL.createObjectURL(new Blob([WORKER_CODE],{type:'application/javascript'}));

// ═══════════════════════════════════════════════════════════
//  100 个动画效果
// ═══════════════════════════════════════════════════════════
const PI = Math.PI, sin = Math.sin, cos = Math.cos, abs = Math.abs, exp = Math.exp, floor = Math.floor, round = Math.round, pow = Math.pow, max = Math.max, min = Math.min;

// 辅助：伪随机（由时间索引决定）
const rnd = (i) => { const x = sin(i * 12.9898 + 78.233) * 43758.5453; return x - floor(x); };

const BUILTIN_EFFECTS = [
  // ─── 渐变 10 ───
  {id:'fade',name:'淡入淡出',emoji:'✨',cat:'渐变',keys:'透明 消失 出现 alpha',fn:t=>({alpha:sin(t*PI)})},
  {id:'fade-in',name:'渐显',emoji:'🌅',cat:'渐变',keys:'淡入 出现',fn:t=>({alpha:t})},
  {id:'fade-out',name:'渐隐',emoji:'🌇',cat:'渐变',keys:'淡出 消失',fn:t=>({alpha:1-t})},
  {id:'blink',name:'闪烁',emoji:'💡',cat:'渐变',keys:'闪 频闪',fn:t=>({alpha:round(sin(t*PI*6)*0.5+0.5)})},
  {id:'breathe',name:'呼吸灯',emoji:'🫧',cat:'渐变',keys:'呼吸 发光 脉冲',fn:t=>{const s=1+sin(t*PI*2)*0.06;return{scaleX:s,scaleY:s,alpha:0.65+sin(t*PI*2)*0.35};}},
  {id:'strobe',name:'频闪',emoji:'⚡',cat:'渐变',keys:'闪烁 快速',fn:t=>({alpha:floor(t*12)%2===0?1:0})},
  {id:'neon-pulse',name:'霓虹脉冲',emoji:'🔆',cat:'渐变',keys:'霓虹 发光',fn:t=>{const p=sin(t*PI*3);return{alpha:0.6+abs(p)*0.4,scaleX:1+p*0.04,scaleY:1+p*0.04};}},
  {id:'ghost-fade',name:'幽灵隐现',emoji:'👻',cat:'渐变',keys:'幽灵 鬼影',fn:t=>({alpha:0.3+sin(t*PI*4)*0.35,y:-sin(t*PI*2)*8})},
  {id:'morse-blink',name:'摩斯闪烁',emoji:'📡',cat:'渐变',keys:'摩斯 密码',fn:t=>{const p=t*12%4;return{alpha:p<1.2||(p>=2&&p<2.3)?1:0};}},
  {id:'soft-glow',name:'柔光脉动',emoji:'🌟',cat:'渐变',keys:'柔和 光晕',fn:t=>{const p=sin(t*PI*2);return{alpha:0.75+p*0.25,scaleX:1+p*0.02,scaleY:1+p*0.02};}},

  // ─── 移动 15 ───
  {id:'float',name:'上下浮动',emoji:'🌊',cat:'移动',keys:'浮 飘',fn:t=>({y:-sin(t*PI*2)*14})},
  {id:'shake',name:'左右摇摆',emoji:'📳',cat:'移动',keys:'抖 晃',fn:t=>({x:sin(t*PI*6)*10})},
  {id:'bounce',name:'弹跳',emoji:'🏀',cat:'移动',keys:'跳 弹',fn:t=>({y:-abs(sin(t*PI*2))*22})},
  {id:'slide-up',name:'向上滑入',emoji:'⬆️',cat:'移动',keys:'进场 滑动',fn:t=>({y:(1-t)*40,alpha:min(t*2.5,1)})},
  {id:'slide-down',name:'向下滑入',emoji:'⬇️',cat:'移动',keys:'进场 滑动',fn:t=>({y:-(1-t)*40,alpha:min(t*2.5,1)})},
  {id:'slide-left',name:'向左滑入',emoji:'⬅️',cat:'移动',keys:'进场 滑动',fn:t=>({x:(1-t)*50,alpha:min(t*2.5,1)})},
  {id:'slide-right',name:'向右滑入',emoji:'➡️',cat:'移动',keys:'进场 滑动',fn:t=>({x:-(1-t)*50,alpha:min(t*2.5,1)})},
  {id:'vibrate',name:'高频抖动',emoji:'📱',cat:'移动',keys:'震动 颤抖',fn:t=>({x:sin(t*PI*22)*5,y:cos(t*PI*19)*3})},
  {id:'drift',name:'漂移',emoji:'🍃',cat:'移动',keys:'飘 漂',fn:t=>({x:sin(t*PI)*20,y:-sin(t*PI*2)*10})},
  {id:'pendulum',name:'钟摆',emoji:'🕰️',cat:'移动',keys:'摆 晃',fn:t=>({rotation:sin(t*PI*2)*22,y:(1-cos(t*PI*2))*4})},
  {id:'gravity-fall',name:'重力落下',emoji:'🎳',cat:'移动',keys:'落下 重力',fn:t=>{const bounce=abs(sin(t*PI*3))*pow(1-t,2);return{y:-bounce*30+(t<0.3?-(0.3-t)*100:0)};}},
  {id:'nod',name:'点头',emoji:'🪆',cat:'移动',keys:'点头 yes',fn:t=>({y:sin(t*PI*4)*8,rotation:sin(t*PI*4)*4})},
  {id:'head-bang',name:'摇头',emoji:'🤘',cat:'移动',keys:'摇头 no',fn:t=>({x:sin(t*PI*5)*14,rotation:sin(t*PI*5)*8})},
  {id:'tipsy',name:'醉醺醺',emoji:'🍺',cat:'移动',keys:'醉 摇晃',fn:t=>({x:sin(t*PI*2)*12+sin(t*PI*5)*4,rotation:sin(t*PI*1.5)*10,y:sin(t*PI*3)*3})},
  {id:'electric-jump',name:'电流游走',emoji:'⚡',cat:'移动',keys:'电 跳',fn:t=>{const s=floor(t*15);return{x:(rnd(s)-0.5)*12,y:(rnd(s+99)-0.5)*8};}},

  // ─── 缩放 15 ───
  {id:'pulse',name:'脉冲缩放',emoji:'💓',cat:'缩放',keys:'脉冲 心跳',fn:t=>{const s=1+sin(t*PI*2)*0.14;return{scaleX:s,scaleY:s};}},
  {id:'zoom-in',name:'逐渐放大',emoji:'🔍',cat:'缩放',keys:'放大 进场',fn:t=>{const s=0.55+t*0.45;return{scaleX:s,scaleY:s,alpha:t};}},
  {id:'zoom-out',name:'逐渐缩小',emoji:'🔎',cat:'缩放',keys:'缩小 消失',fn:t=>{const s=1-t*0.45;return{scaleX:s,scaleY:s,alpha:1-t};}},
  {id:'heartbeat',name:'心跳',emoji:'❤️',cat:'缩放',keys:'心 爱心',fn:t=>{const p=t%0.5/0.5;const b=p<0.12?1+p*3:p<0.24?1.36-(p-0.12)*2:p<0.36?1.12+(p-0.24)*2:p<0.48?1.36-(p-0.36)*3:1;return{scaleX:b,scaleY:b};}},
  {id:'pop',name:'弹出',emoji:'🎈',cat:'缩放',keys:'弹 进场',fn:t=>{if(t<0.35){const s=(t/0.35)*1.28;return{scaleX:s,scaleY:s,alpha:t/0.35};}if(t<0.55){const s=1.28-(t-0.35)/0.2*0.28;return{scaleX:s,scaleY:s};}return{};}},
  {id:'jello',name:'果冻抖动',emoji:'🟡',cat:'缩放',keys:'果冻 扭',fn:t=>{const d=max(0,1-t*1.8);return{scaleX:1+sin(t*PI*5)*0.28*d,scaleY:1-sin(t*PI*5)*0.18*d};}},
  {id:'rubber',name:'橡皮筋',emoji:'🪀',cat:'缩放',keys:'弹性 拉伸',fn:t=>{const p=t*PI*2;return{scaleX:1+sin(p)*0.2,scaleY:1-sin(p)*0.14};}},
  {id:'squeeze',name:'挤压弹跳',emoji:'🫴',cat:'缩放',keys:'压缩 挤',fn:t=>{const s=sin(t*PI);return{scaleX:1+s*0.35,scaleY:1-s*0.22};}},
  {id:'impact',name:'冲击落地',emoji:'💢',cat:'缩放',keys:'冲击 落地',fn:t=>{if(t<0.2){const s=1+(0.2-t)*3;return{scaleY:s,scaleX:1/(s*0.5+0.5),y:-(0.2-t)*60};}const b=exp(-(t-0.2)*8);return{scaleX:1+b*0.2,scaleY:1-b*0.15};}},
  {id:'stamp',name:'盖章',emoji:'📮',cat:'缩放',keys:'盖章 砸下',fn:t=>{if(t<0.3){return{scaleX:1.8-t*2.5,scaleY:1.8-t*2.5,alpha:t*3};}if(t<0.45){const s=1-sin((t-0.3)/0.15*PI)*0.1;return{scaleX:s,scaleY:s};}return{};}},
  {id:'drip',name:'滴落拉伸',emoji:'💧',cat:'缩放',keys:'滴 拉',fn:t=>{const s=sin(t*PI*2);return{scaleY:1+max(0,s)*0.5,scaleX:1-max(0,s)*0.15,y:max(0,s)*15};}},
  {id:'melt',name:'融化变形',emoji:'🫠',cat:'缩放',keys:'融 化',fn:t=>({scaleY:1+t*0.3,scaleX:1-t*0.1,y:t*12,alpha:1-t*0.2})},
  {id:'implode',name:'向内坍塌',emoji:'🌀',cat:'缩放',keys:'坍塌 消失',fn:t=>{const s=1-pow(t,2);return{scaleX:s,scaleY:s,rotation:t*360,alpha:s};}},
  {id:'explode-scale',name:'向外爆炸',emoji:'💥',cat:'缩放',keys:'爆炸 放大',fn:t=>({scaleX:1+pow(t,2)*3,scaleY:1+pow(t,2)*3,alpha:1-t*t})},
  {id:'spring-bounce',name:'弹簧反弹',emoji:'🪝',cat:'缩放',keys:'弹簧 反弹',fn:t=>{const s=1+sin(t*PI*4)*exp(-t*3)*0.3;return{scaleX:s,scaleY:s};}},

  // ─── 旋转 15 ───
  {id:'rotate-cw',name:'顺时针转',emoji:'🌀',cat:'旋转',keys:'旋转 rotate',fn:t=>({rotation:t*360})},
  {id:'rotate-ccw',name:'逆时针转',emoji:'↩️',cat:'旋转',keys:'旋转 逆',fn:t=>({rotation:-t*360})},
  {id:'rotate-2',name:'双圈旋转',emoji:'💫',cat:'旋转',keys:'旋转 快',fn:t=>({rotation:t*720})},
  {id:'swing',name:'左右晃动',emoji:'🎸',cat:'旋转',keys:'晃 摇',fn:t=>({rotation:sin(t*PI*2)*18})},
  {id:'wobble',name:'摇摆衰减',emoji:'🎯',cat:'旋转',keys:'摇 衰减',fn:t=>{const d=exp(-t*3.5);return{rotation:sin(t*PI*6)*24*d,x:sin(t*PI*6)*8*d};}},
  {id:'spin-fade',name:'旋转消失',emoji:'🌪️',cat:'旋转',keys:'旋转 消失',fn:t=>({rotation:t*540,alpha:1-t,scaleX:1-t*0.4,scaleY:1-t*0.4})},
  {id:'flip-h',name:'水平翻转',emoji:'↔️',cat:'旋转',keys:'翻转 水平',fn:t=>({scaleX:cos(t*PI*2)})},
  {id:'flip-v',name:'垂直翻转',emoji:'↕️',cat:'旋转',keys:'翻转 垂直',fn:t=>({scaleY:cos(t*PI*2)})},
  {id:'spiral-out',name:'螺旋展开',emoji:'🌀',cat:'旋转',keys:'螺旋 进场',fn:t=>{const r=(1-t)*45;const a=(1-t)*PI*4;const s=0.2+t*0.8;return{x:cos(a)*r,y:sin(a)*r,rotation:t*720,scaleX:s,scaleY:s,alpha:t};}},
  {id:'spin-fast',name:'闪速旋转',emoji:'⚡',cat:'旋转',keys:'旋转 闪速',fn:t=>({rotation:t*1440})},
  {id:'clock-tick',name:'时钟滴答',emoji:'🕐',cat:'旋转',keys:'时钟 滴答',fn:t=>({rotation:floor(t*12)*30})},
  {id:'helicopter',name:'直升机螺旋',emoji:'🚁',cat:'旋转',keys:'直升机',fn:t=>({rotation:t*1080,x:sin(t*PI*2)*6,y:cos(t*PI*3)*4})},
  {id:'tilt-chaos',name:'混沌倾斜',emoji:'🌊',cat:'旋转',keys:'混沌 倾斜',fn:t=>({rotation:sin(t*PI*3)*45+sin(t*PI*7)*15,x:sin(t*PI*4)*8})},
  {id:'gyroscope',name:'陀螺仪',emoji:'🌐',cat:'旋转',keys:'陀螺',fn:t=>{const a=t*PI*4;return{rotation:a*180/PI,scaleX:cos(a)*0.6+0.4,scaleY:1};}},
  {id:'pinwheel',name:'风车',emoji:'🎑',cat:'旋转',keys:'风车',fn:t=>{const acc=pow(t,2);return{rotation:acc*720};}},

  // ─── 组合 20 ───
  {id:'tada',name:'Tada！',emoji:'🎉',cat:'组合',keys:'庆祝 tada',fn:t=>({x:sin(t*PI*8)*8,scaleX:1+sin(t*PI)*0.07,scaleY:1+sin(t*PI)*0.07})},
  {id:'bounce-spin',name:'弹跳旋转',emoji:'🎠',cat:'组合',keys:'弹跳 旋转',fn:t=>({y:-abs(sin(t*PI*2))*20,rotation:t*360})},
  {id:'float-spin',name:'浮动旋转',emoji:'🎡',cat:'组合',keys:'浮动 旋转',fn:t=>({y:-sin(t*PI*2)*12,rotation:sin(t*PI*2)*22})},
  {id:'figure8',name:'8字运动',emoji:'♾️',cat:'组合',keys:'8 轨迹',fn:t=>{const a=t*PI*2;return{x:sin(a)*22,y:sin(a*2)*11};}},
  {id:'orbit',name:'轨道环绕',emoji:'🪐',cat:'组合',keys:'轨道 环绕',fn:t=>{const a=t*PI*2;return{x:cos(a)*20,y:sin(a)*11};}},
  {id:'shockwave',name:'冲击波',emoji:'💥',cat:'组合',keys:'冲击 震',fn:t=>{if(t<0.25){const s=1+(t/0.25)*0.45;return{scaleX:s,scaleY:s};}const p=(t-0.25)/0.75;const s=1.45-p*0.45;return{scaleX:s,scaleY:s,alpha:1-p*p};}},
  {id:'ripple',name:'水波纹',emoji:'💧',cat:'组合',keys:'水 波纹',fn:t=>{const s=1+sin(t*PI*3)*0.11;return{scaleX:s,scaleY:1/s,alpha:0.65+sin(t*PI*3)*0.35};}},
  {id:'tiktok',name:'抖音风',emoji:'🎵',cat:'组合',keys:'抖音 节奏',fn:t=>({x:sin(t*PI*10)*4,y:sin(t*PI*13)*3,rotation:sin(t*PI*8)*5})},
  {id:'wave-dance',name:'波浪舞',emoji:'🌈',cat:'组合',keys:'波浪 律动',fn:t=>({x:sin(t*PI*4)*14,y:-sin(t*PI*2)*9,rotation:sin(t*PI*4)*10})},
  {id:'explosive',name:'爆炸弹出',emoji:'🚀',cat:'组合',keys:'爆炸 进场',fn:t=>{if(t<0.18){const s=t/0.18*1.35;return{scaleX:s,scaleY:s,alpha:t/0.18};}if(t<0.38){const p=(t-0.18)/0.2;return{scaleX:1.35-p*0.35,scaleY:1.35-p*0.35};}return{alpha:1-(t-0.38)/0.62};}},
  {id:'spiral-in',name:'螺旋进场',emoji:'🌪️',cat:'组合',keys:'螺旋 进场',fn:t=>{const r=(1-t)*42;const a=(1-t)*PI*4;const s=0.3+t*0.7;return{x:cos(a)*r,y:sin(a)*r,scaleX:s,scaleY:s,alpha:t};}},
  {id:'pendulum-swing',name:'大钟摆',emoji:'⚖️',cat:'组合',keys:'钟摆',fn:t=>{const angle=sin(t*PI*2)*30;const rad=angle*PI/180;return{x:sin(rad)*18,y:(1-cos(rad))*6,rotation:angle};}},
  {id:'drunk-walk',name:'醉步',emoji:'🍻',cat:'组合',keys:'醉步',fn:t=>({x:sin(t*PI*2.5)*18,rotation:sin(t*PI*2.7)*12,y:sin(t*PI*5.1)*4})},
  {id:'hyper-shake',name:'疯狂抖动',emoji:'🤪',cat:'组合',keys:'疯狂 抖',fn:t=>{const s=floor(t*30);return{x:(rnd(s)-0.5)*18,y:(rnd(s+11)-0.5)*14,rotation:(rnd(s+22)-0.5)*12};}},
  {id:'dimension-warp',name:'维度扭曲',emoji:'🔮',cat:'组合',keys:'维度 扭曲',fn:t=>{const p=sin(t*PI*2);return{scaleX:1+p*0.5,scaleY:1-p*0.5,rotation:p*8};}},
  {id:'spiral-fall',name:'螺旋坠落',emoji:'🌀',cat:'组合',keys:'螺旋 落',fn:t=>({y:t*30-15,rotation:t*720,scaleX:1-t*0.3,scaleY:1-t*0.3,alpha:1-t*0.5})},
  {id:'tornado',name:'龙卷风',emoji:'🌪️',cat:'组合',keys:'龙卷',fn:t=>({rotation:t*1080,scaleX:1-t*0.4,scaleY:1-t*0.4,x:sin(t*PI*8)*5})},
  {id:'magnetic-pull',name:'磁力吸引',emoji:'🧲',cat:'组合',keys:'磁力',fn:t=>{const p=sin(t*PI);return{x:(p<0.5?sin(t*PI*2)*25:-sin(t*PI*2)*25),scaleX:1+abs(p)*0.1};}},
  {id:'roll-in',name:'滚入场',emoji:'⚽',cat:'组合',keys:'滚 进场',fn:t=>({x:(1-t)*50,rotation:(1-t)*-540,alpha:min(t*2,1)})},
  {id:'flip-bounce',name:'翻转弹跳',emoji:'🤸',cat:'组合',keys:'翻转 弹',fn:t=>({rotation:t*360,y:-abs(sin(t*PI*2))*15,scaleX:cos(t*PI*2)})},

  // ─── 扭曲 10 ───
  {id:'wave-distort',name:'波浪扭曲',emoji:'〰️',cat:'扭曲',keys:'波浪 变形',fn:t=>{const p=t*PI*3;return{scaleX:1+sin(p)*0.25,scaleY:1+cos(p)*0.18};}},
  {id:'glitch',name:'数字故障',emoji:'👾',cat:'扭曲',keys:'glitch 故障',fn:t=>{const s=floor(t*20);const j1=rnd(s),j2=rnd(s+7);return{x:(j1-0.5)*12,y:(j2-0.5)*6,scaleX:1+(j1-0.5)*0.1,alpha:j2>0.95?0.3:1};}},
  {id:'jitter',name:'随机颤抖',emoji:'🫨',cat:'扭曲',keys:'颤抖',fn:t=>{const s=floor(t*50);return{x:(rnd(s)-0.5)*4,y:(rnd(s+1)-0.5)*4};}},
  {id:'rubber-band',name:'弹弓效果',emoji:'🏹',cat:'扭曲',keys:'弹弓 拉',fn:t=>{if(t<0.3){const p=t/0.3;return{scaleX:1+p*0.4,scaleY:1-p*0.2};}const p=(t-0.3)/0.7;const sp=sin(p*PI*3)*exp(-p*3);return{x:-p*40+sp*20,scaleX:1+sp*0.1};}},
  {id:'earthquake',name:'地震效果',emoji:'🌋',cat:'扭曲',keys:'地震',fn:t=>{const s=floor(t*40);return{x:(rnd(s)-0.5)*16,y:(rnd(s+3)-0.5)*10,rotation:(rnd(s+5)-0.5)*8};}},
  {id:'warp-speed',name:'扭曲加速',emoji:'🚀',cat:'扭曲',keys:'加速',fn:t=>{const p=pow(t,3);return{scaleX:1-p*0.4,scaleY:1+p*2.5,alpha:1-p*0.3};}},
  {id:'matrix-glitch',name:'矩阵故障',emoji:'💻',cat:'扭曲',keys:'矩阵',fn:t=>{const s=floor(t*15);return{y:(rnd(s)-0.5)*8,scaleX:1+(rnd(s+2)-0.5)*0.15,alpha:rnd(s+4)>0.9?0.5:1};}},
  {id:'acid-trip',name:'幻觉扭曲',emoji:'🌈',cat:'扭曲',keys:'幻觉',fn:t=>{const p=t*PI*4;return{scaleX:1+sin(p)*0.2,scaleY:1+cos(p*1.3)*0.2,rotation:sin(p*0.7)*8};}},
  {id:'scanner',name:'扫描线',emoji:'📡',cat:'扭曲',keys:'扫描',fn:t=>({alpha:0.4+sin(t*PI*6)*0.3+(sin(t*PI*30)*0.15)})},
  {id:'hologram',name:'全息投影',emoji:'💠',cat:'扭曲',keys:'全息',fn:t=>{const p=floor(t*25);return{alpha:0.7+rnd(p)*0.3,y:(rnd(p+9)-0.5)*3,scaleX:1+(rnd(p+1)-0.5)*0.05};}},

  // ─── 可爱 15 ───
  {id:'cute-bounce',name:'萌系弹跳',emoji:'🐰',cat:'可爱',keys:'萌 弹跳',fn:t=>{const b=abs(sin(t*PI*2));return{y:-b*18,scaleX:1+(1-b)*0.15,scaleY:1-(1-b)*0.1};}},
  {id:'wiggle',name:'扭屁股',emoji:'🐛',cat:'可爱',keys:'扭 摆',fn:t=>({x:sin(t*PI*5)*8,rotation:sin(t*PI*5)*6,scaleX:1+sin(t*PI*5)*0.08})},
  {id:'kawaii-shake',name:'卖萌抖动',emoji:'🌸',cat:'可爱',keys:'萌 卖',fn:t=>({x:sin(t*PI*8)*3,y:cos(t*PI*6)*2,rotation:sin(t*PI*8)*3,scaleX:1+sin(t*PI*4)*0.05,scaleY:1+cos(t*PI*4)*0.05})},
  {id:'nyan',name:'彩虹飞行',emoji:'🌈',cat:'可爱',keys:'彩虹 飞',fn:t=>({x:sin(t*PI*2)*25,y:cos(t*PI*3)*6,rotation:sin(t*PI*4)*8})},
  {id:'disco',name:'迪斯科',emoji:'🕺',cat:'可爱',keys:'迪斯科',fn:t=>{const beat=floor(t*8);return{scaleX:1+(beat%2?0.15:-0.05),scaleY:1+(beat%2?-0.05:0.15),rotation:(beat%4-1.5)*10};}},
  {id:'derp',name:'呆萌',emoji:'😵',cat:'可爱',keys:'呆萌',fn:t=>({x:sin(t*PI*1.3)*6,y:sin(t*PI*1.7)*4,rotation:sin(t*PI*0.9)*5,scaleX:1+sin(t*PI*2.3)*0.04})},
  {id:'hyper-spin',name:'超速旋转',emoji:'🌀',cat:'可爱',keys:'超速',fn:t=>({rotation:t*2160,scaleX:0.9+sin(t*PI*4)*0.1,scaleY:0.9+sin(t*PI*4)*0.1})},
  {id:'crazy-eyes',name:'眼花缭乱',emoji:'😵‍💫',cat:'可爱',keys:'眼花',fn:t=>{const p=t*PI*2;return{x:sin(p*3)*8,y:cos(p*5)*6,scaleX:1+sin(p*7)*0.1,scaleY:1+cos(p*4)*0.1,rotation:sin(p*2)*15};}},
  {id:'yo-yo',name:'溜溜球',emoji:'🪀',cat:'可爱',keys:'溜溜',fn:t=>{const s=0.5+abs(sin(t*PI*2))*0.7;return{scaleX:s,scaleY:s,y:sin(t*PI*4)*10};}},
  {id:'silly-walk',name:'怪走路',emoji:'🚶',cat:'可爱',keys:'怪走',fn:t=>({x:sin(t*PI*2)*15,y:abs(sin(t*PI*4))*-8,rotation:sin(t*PI*2)*8})},
  {id:'jelly-float',name:'水母漂游',emoji:'🪼',cat:'可爱',keys:'水母',fn:t=>{const p=t*PI*2;return{y:-sin(p)*10,scaleX:1+sin(p*2)*0.15,scaleY:1+cos(p*2)*0.15};}},
  {id:'candy-pop',name:'糖果弹出',emoji:'🍬',cat:'可爱',keys:'糖果 弹',fn:t=>{if(t<0.25){const p=t/0.25;return{scaleX:sin(p*PI/2)*1.3,scaleY:sin(p*PI/2)*1.3,rotation:-p*30,alpha:p};}const p=(t-0.25)/0.75;return{scaleX:1.3-p*0.3,scaleY:1.3-p*0.3,rotation:-30+p*30};}},
  {id:'dumb-dumb',name:'傻乎乎',emoji:'😜',cat:'可爱',keys:'傻',fn:t=>({rotation:sin(t*PI*2)*15,y:sin(t*PI*3)*5,scaleX:1+sin(t*PI*2.5)*0.08})},
  {id:'star-burst',name:'星爆',emoji:'⭐',cat:'可爱',keys:'星 爆',fn:t=>{const p=sin(t*PI);return{scaleX:1+p*0.25,scaleY:1+p*0.25,rotation:t*360,alpha:0.7+p*0.3};}},
  {id:'ultra-chaos',name:'终极混沌',emoji:'🤯',cat:'可爱',keys:'混沌',fn:t=>{const p=t*PI*2,s=floor(t*20);return{x:sin(p*3)*12+(rnd(s)-0.5)*8,y:cos(p*4)*8+(rnd(s+1)-0.5)*6,rotation:sin(p*2)*30+(rnd(s+2)-0.5)*20,scaleX:1+sin(p*5)*0.15,scaleY:1+cos(p*7)*0.15};}},

  // ─── 表情包专用 30（专为动态表情包设计，动作夸张，循环流畅）───
  {id:'meme-vibe',name:'鬼畜摇头',emoji:'🎶',cat:'表情包',keys:'鬼畜 摇头 meme',
    fn:t=>({rotation:sin(t*PI*16)*18,y:abs(sin(t*PI*16))*-4,scaleX:1+sin(t*PI*32)*0.05,scaleY:1-sin(t*PI*32)*0.03})},
  {id:'meme-nod-hard',name:'猛烈点头',emoji:'💯',cat:'表情包',keys:'点头 对 是',
    fn:t=>({y:sin(t*PI*10)*14,rotation:sin(t*PI*10)*6,scaleY:1-abs(sin(t*PI*10))*0.08})},
  {id:'meme-shake-no',name:'坚决摇头',emoji:'🙅',cat:'表情包',keys:'不 no 摇头',
    fn:t=>({x:sin(t*PI*10)*18,rotation:sin(t*PI*10)*10})},
  {id:'meme-crazy-shake',name:'疯狂抖动',emoji:'🤪',cat:'表情包',keys:'疯狂 抖 鬼畜',
    fn:t=>{const s=floor(t*40);return{x:(rnd(s)-0.5)*30,y:(rnd(s+3)-0.5)*20,rotation:(rnd(s+7)-0.5)*40,scaleX:1+(rnd(s+11)-0.5)*0.2,scaleY:1+(rnd(s+13)-0.5)*0.2};}},
  {id:'meme-wtf',name:'黑人问号',emoji:'❓',cat:'表情包',keys:'问号 懵 问',
    fn:t=>{const p=sin(t*PI*2);return{rotation:p*22,x:p*10,scaleX:1+abs(p)*0.1,scaleY:1+abs(p)*0.1};}},
  {id:'meme-lol',name:'嘎嘎狂笑',emoji:'🤣',cat:'表情包',keys:'笑 哈哈 lol',
    fn:t=>{const f=t*PI*14;return{scaleX:1+sin(f)*0.14,scaleY:1-sin(f)*0.08,x:sin(f*0.5)*7,rotation:sin(f*0.35)*10};}},
  {id:'meme-faint',name:'笑晕过去',emoji:'😵',cat:'表情包',keys:'晕 笑倒',
    fn:t=>{const p=t<0.5?t*2:1-(t-0.5)*2;return{rotation:p*80,y:p*16,scaleY:1-p*0.2,scaleX:1+p*0.1};}},
  {id:'meme-zoom-panic',name:'惊慌放大',emoji:'😱',cat:'表情包',keys:'惊 慌 放大',
    fn:t=>{if(t<0.5){const s=1+pow(t/0.5,2)*1.3;return{scaleX:s,scaleY:s};}const sh=sin((t-0.5)*PI*40)*(1-(t-0.5))*12;return{scaleX:2.3,scaleY:2.3,x:sh,y:cos((t-0.5)*PI*32)*(1-(t-0.5))*8};}},
  {id:'meme-brain-boom',name:'脑子炸了',emoji:'🤯',cat:'表情包',keys:'炸 脑 爆',
    fn:t=>{if(t<0.3){const s=1+sin(t/0.3*PI*8)*0.12;return{scaleX:s,scaleY:s};}if(t<0.55){const p=(t-0.3)/0.25;const s=1+p*p*3.5;return{scaleX:s,scaleY:s,alpha:1-p*0.6};}return{scaleX:3.5,scaleY:3.5,alpha:0};}},
  {id:'meme-big-energy',name:'big 能量',emoji:'⚡',cat:'表情包',keys:'能量 big',
    fn:t=>{const pulse=abs(sin(t*PI*6));return{scaleX:1+pulse*0.28,scaleY:1+pulse*0.28,rotation:sin(t*PI*2)*6,x:sin(t*PI*16)*2};}},
  {id:'meme-defeat',name:'emo 躺平',emoji:'😔',cat:'表情包',keys:'躺平 emo 丧',
    fn:t=>{const p=sin(t*PI);return{y:p*20,rotation:p*12,scaleY:1-p*0.12,alpha:1-p*0.15};}},
  {id:'meme-showoff',name:'自信展示',emoji:'💪',cat:'表情包',keys:'展示 秀 自信',
    fn:t=>{const p=sin(t*PI);return{scaleX:1+p*0.2,scaleY:1+p*0.2,rotation:p*-6,y:-p*4};}},
  {id:'meme-turn-away',name:'哼 转身走',emoji:'😤',cat:'表情包',keys:'转身 哼 生气',
    fn:t=>{if(t<0.3){return{scaleX:1-(t/0.3)*1.9,rotation:(t/0.3)*35};}if(t<0.55){const p=(t-0.3)/0.25;return{scaleX:-0.9+p*1.9,rotation:35-p*35};}return{};}},
  {id:'meme-pose',name:'帅气定格',emoji:'🕶️',cat:'表情包',keys:'帅 定格 酷',
    fn:t=>{if(t<0.15){const p=t/0.15;return{x:(1-p)*90,rotation:-(1-p)*60,scaleX:0.4+p*0.6,scaleY:0.4+p*0.6,alpha:p};}if(t<0.28){const sh=sin((t-0.15)*PI*12)*3.5;return{x:sh};}return{};}},
  {id:'meme-hiphop',name:'鬼步律动',emoji:'🕺',cat:'表情包',keys:'鬼步 跳舞 律动',
    fn:t=>{const bp=(t*8)%1;const beat=floor(t*8);const dir=beat%2?1:-1;return{x:dir*sin(bp*PI)*14,y:-abs(sin(bp*PI*2))*10,rotation:dir*sin(bp*PI)*10};}},
  {id:'meme-panic',name:'慌得一批',emoji:'😵‍💫',cat:'表情包',keys:'慌 急 乱',
    fn:t=>{const s=floor(t*50);return{x:(rnd(s)-0.5)*28,y:(rnd(s+17)-0.5)*18,rotation:(rnd(s+33)-0.5)*22,scaleX:1+(rnd(s+41)-0.5)*0.15};}},
  {id:'meme-rise',name:'地位上升',emoji:'📈',cat:'表情包',keys:'上升 涨 成功',
    fn:t=>{const p=t<0.7?t/0.7:1;const s=1+p*0.35;return{y:-p*25,scaleX:s,scaleY:s,rotation:(1-p)*-8};}},
  {id:'meme-fall',name:'跌落谷底',emoji:'📉',cat:'表情包',keys:'跌 下 失败',
    fn:t=>{const s=1-t*0.35;return{y:t*28,scaleX:s,scaleY:s,alpha:1-t*0.4,rotation:t*35};}},
  {id:'meme-nope',name:'坚决拒绝',emoji:'🚫',cat:'表情包',keys:'拒绝 no 不要',
    fn:t=>({x:sin(t*PI*10)*20,rotation:sin(t*PI*10)*14})},
  {id:'meme-shy',name:'害羞扭动',emoji:'☺️',cat:'表情包',keys:'害羞 扭 萌',
    fn:t=>{const p=sin(t*PI*4);return{x:p*9,rotation:p*12,scaleY:1+abs(p)*0.06,scaleX:1-abs(p)*0.04};}},
  {id:'meme-peek',name:'偷偷观察',emoji:'👀',cat:'表情包',keys:'偷看 躲',
    fn:t=>{const p=t*PI*3;return{x:-60+sin(p)*65,alpha:0.4+abs(sin(p*2))*0.6,rotation:sin(p)*6};}},
  {id:'meme-rollin',name:'笑到打滚',emoji:'🤸',cat:'表情包',keys:'打滚 翻滚',
    fn:t=>({rotation:t*720,x:sin(t*PI*2)*18,y:-abs(sin(t*PI*4))*10})},
  {id:'meme-hot',name:'这很赞',emoji:'🔥',cat:'表情包',keys:'赞 火 牛',
    fn:t=>{const s=floor(t*30);const jitter=sin(t*PI*14)*2.5;return{x:jitter+(rnd(s)-0.5)*3,scaleY:1+sin(t*PI*8)*0.1,scaleX:1-sin(t*PI*8)*0.04};}},
  {id:'meme-poof',name:'溜了溜了',emoji:'💨',cat:'表情包',keys:'溜 跑 走',
    fn:t=>{if(t<0.4)return{};const p=(t-0.4)/0.6;return{x:-p*p*80,rotation:-p*120,scaleX:1-p*0.5,scaleY:1-p*0.5,alpha:1-p};}},
  {id:'meme-boss',name:'霸气登场',emoji:'👑',cat:'表情包',keys:'登场 霸气 出场',
    fn:t=>{if(t<0.4){const p=t/0.4;const s=pow(p,2)*1.25;return{scaleX:s,scaleY:s,rotation:(1-p)*540,alpha:p};}if(t<0.55){const sh=sin((t-0.4)*PI*20)*5;return{scaleX:1.25,scaleY:1.25,x:sh};}return{scaleX:1.25,scaleY:1.25};}},
  {id:'meme-flex',name:'秀肌肉',emoji:'💪',cat:'表情包',keys:'秀 肌肉 炫',
    fn:t=>{const p=t%0.5/0.5;if(p<0.25){const b=p/0.25;return{scaleX:1+b*0.35,scaleY:1+b*0.2};}if(p<0.5){return{scaleX:1.35,scaleY:1.2};}const b=(1-p)*2;return{scaleX:1+b*0.35,scaleY:1+b*0.2};}},
  {id:'meme-drop',name:'麦克风砸地',emoji:'🎤',cat:'表情包',keys:'砸 下 mic',
    fn:t=>{if(t<0.4){return{y:-(0.4-t)*80,rotation:-(0.4-t)*30};}if(t<0.55){const p=(t-0.4)/0.15;return{scaleY:1-sin(p*PI)*0.3,scaleX:1+sin(p*PI)*0.2};}return{};}},
  {id:'meme-slide',name:'滑跪登场',emoji:'🏂',cat:'表情包',keys:'滑 跪 登场',
    fn:t=>{if(t<0.5){const p=t/0.5;return{x:(1-p)*100,rotation:(1-p)*-15,alpha:p};}if(t<0.65){const sh=sin((t-0.5)*PI*15)*5;return{x:sh,y:sh*0.3};}return{};}},
  {id:'meme-aggressive-zoom',name:'战术放大',emoji:'🔍',cat:'表情包',keys:'战术 放大',
    fn:t=>{const steps=[1,1.3,1,1.8,1,2.3,1];const i=floor(t*steps.length)%steps.length;const ni=(i+1)%steps.length;const p=(t*steps.length)%1;const s=steps[i]+(steps[ni]-steps[i])*p;return{scaleX:s,scaleY:s};}},
  {id:'meme-whip',name:'鞭打特效',emoji:'🎯',cat:'表情包',keys:'鞭打 快速',
    fn:t=>{if(t<0.25){const p=t/0.25;return{x:(1-p)*-80,rotation:(1-p)*-45,scaleX:0.5+p*0.5,scaleY:0.5+p*0.5};}if(t<0.45){const p=(t-0.25)/0.2;return{x:sin(p*PI)*15,rotation:sin(p*PI*2)*8};}return{};}},

  // ═══ 表情包扩展 70 个 (总计 100 个专属表情包效果) ═══

  // ─── 尺寸变换类 10 ───
  {id:'m2-elastic-boom',name:'弹性爆开',emoji:'💥',cat:'表情包',keys:'弹性 爆开 pop',
    fn:t=>{const p=sin(t*PI);const s=1+p*0.9+sin(t*PI*8)*exp(-t*3)*0.15;return{scaleX:s,scaleY:s};}},
  {id:'m2-wide-stretch',name:'横向拉长',emoji:'🔁',cat:'表情包',keys:'拉长 扁',
    fn:t=>{const p=sin(t*PI);return{scaleX:1+p*0.8,scaleY:1-p*0.2};}},
  {id:'m2-tall-stretch',name:'竖向拔高',emoji:'📏',cat:'表情包',keys:'拔高 细长',
    fn:t=>{const p=sin(t*PI);return{scaleX:1-p*0.25,scaleY:1+p*0.9};}},
  {id:'m2-balloon',name:'充气鼓胀',emoji:'🎈',cat:'表情包',keys:'气球 鼓',
    fn:t=>{const p=sin(t*PI);const s=1+p*0.55+sin(t*PI*6)*0.02*p;return{scaleX:s,scaleY:s};}},
  {id:'m2-deflate',name:'漏气瘪掉',emoji:'🎐',cat:'表情包',keys:'漏气 瘪',
    fn:t=>{const p=sin(t*PI);const s=1-p*0.45;return{scaleX:s+sin(t*PI*12)*0.03*p,scaleY:s-sin(t*PI*12)*0.03*p};}},
  {id:'m2-mega-pulse',name:'极速脉冲',emoji:'💓',cat:'表情包',keys:'脉冲 快 心跳',
    fn:t=>{const s=1+abs(sin(t*PI*12))*0.3;return{scaleX:s,scaleY:s};}},
  {id:'m2-sudden-big',name:'突然变大',emoji:'🔍',cat:'表情包',keys:'突变 大',
    fn:t=>{const s=t<0.35?1:t<0.55?1+(t-0.35)/0.2*0.7:t<0.78?1.7:1+(1-t)/0.22*0.7;return{scaleX:s,scaleY:s};}},
  {id:'m2-sudden-small',name:'突然变小',emoji:'🤏',cat:'表情包',keys:'突变 小',
    fn:t=>{const s=t<0.35?1:t<0.55?1-(t-0.35)/0.2*0.55:t<0.78?0.45:0.45+(t-0.78)/0.22*0.55;return{scaleX:s,scaleY:s};}},
  {id:'m2-counter-pulse',name:'反向脉动',emoji:'⏸️',cat:'表情包',keys:'反向',
    fn:t=>{const p=sin(t*PI*4);return{scaleX:1+p*0.28,scaleY:1-p*0.28};}},
  {id:'m2-dimension-chaos',name:'维度错乱',emoji:'🌀',cat:'表情包',keys:'维度',
    fn:t=>{const p=t*PI*3;return{scaleX:1+sin(p)*0.35,scaleY:1+cos(p*1.3)*0.35,rotation:sin(p*0.7)*10};}},

  // ─── 旋转类 10 ───
  {id:'m2-gyro-wobble',name:'陀螺无双',emoji:'💫',cat:'表情包',keys:'陀螺 旋',
    fn:t=>({rotation:t*720,x:sin(t*PI*8)*6,y:cos(t*PI*9)*4})},
  {id:'m2-barrel-roll',name:'横滚翻腾',emoji:'🎢',cat:'表情包',keys:'横滚',
    fn:t=>({scaleX:cos(t*PI*2),rotation:sin(t*PI*2)*12})},
  {id:'m2-3d-flip-y',name:'3D 翻卡',emoji:'🔄',cat:'表情包',keys:'3d 翻',
    fn:t=>{const p=t*PI*2;return{scaleY:cos(p),y:sin(p)*10};}},
  {id:'m2-drill-spin',name:'钻头冲击',emoji:'🔩',cat:'表情包',keys:'钻头',
    fn:t=>{const s=1+sin(t*PI)*0.3;return{rotation:t*1080,scaleX:s,scaleY:s};}},
  {id:'m2-random-rot',name:'随机角度',emoji:'🎲',cat:'表情包',keys:'随机 角度',
    fn:t=>{const s=floor(t*10);return{rotation:(rnd(s)-0.5)*90,x:(rnd(s+7)-0.5)*6};}},
  {id:'m2-quick-spin-stop',name:'急转定格',emoji:'⚡',cat:'表情包',keys:'急转',
    fn:t=>{if(t<0.3)return{rotation:t/0.3*360};if(t<0.5){const sh=sin((t-0.3)*PI*16)*6*(1-(t-0.3)/0.2);return{rotation:360,x:sh};}return{rotation:360};}},
  {id:'m2-spiral-down',name:'螺旋降落',emoji:'🍃',cat:'表情包',keys:'螺旋',
    fn:t=>({rotation:t*540,y:pow(t,2)*28,scaleX:1-t*0.3,scaleY:1-t*0.3,alpha:1-t*0.3})},
  {id:'m2-eye-roll-y',name:'翻白眼',emoji:'🙄',cat:'表情包',keys:'翻白眼',
    fn:t=>{const p=t<0.5?t*2:(1-t)*2;return{scaleY:1-p*1.7,y:-p*8};}},
  {id:'m2-full-tornado',name:'天旋地转',emoji:'🌪️',cat:'表情包',keys:'天旋',
    fn:t=>({rotation:t*1080,x:sin(t*PI*4)*15,y:cos(t*PI*5)*10,scaleX:1-sin(t*PI)*0.25,scaleY:1-sin(t*PI)*0.25})},
  {id:'m2-warp-spin',name:'光速旋转',emoji:'✨',cat:'表情包',keys:'光速 旋',
    fn:t=>{const r=pow(t,2)*2160;return{rotation:r,scaleX:1-t*0.3,scaleY:1-t*0.3,alpha:1-t*0.4};}},

  // ─── 移动类 10 ───
  {id:'m2-strut-walk',name:'走秀步伐',emoji:'💃',cat:'表情包',keys:'走秀',
    fn:t=>{const bp=(t*6)%1;const beat=floor(t*6);const dir=beat%2?1:-1;return{x:dir*sin(bp*PI)*14,y:-abs(sin(bp*PI*2))*6,rotation:dir*4};}},
  {id:'m2-step-back',name:'缓缓后退',emoji:'👣',cat:'表情包',keys:'后退',
    fn:t=>{const p=sin(t*PI);return{x:-p*35,scaleX:1-p*0.08,scaleY:1-p*0.08,alpha:1-p*0.15};}},
  {id:'m2-fast-dash',name:'闪现而过',emoji:'🏃',cat:'表情包',keys:'闪现 快',
    fn:t=>{if(t<0.1||t>0.9)return{};const p=(t-0.1)/0.8;return{x:-120+p*240};}},
  {id:'m2-heavy-drop',name:'垂直坠落',emoji:'⬇️',cat:'表情包',keys:'坠落 跌',
    fn:t=>{if(t<0.45){const p=t/0.45;return{y:-(1-p*p)*40};}if(t<0.6){const p=(t-0.45)/0.15;return{scaleY:1-sin(p*PI)*0.25,scaleX:1+sin(p*PI)*0.18};}return{};}},
  {id:'m2-anti-gravity',name:'反重力飘',emoji:'🪂',cat:'表情包',keys:'反重力',
    fn:t=>{const p=sin(t*PI);return{y:-p*30+sin(t*PI*6)*3,alpha:1-p*0.15};}},
  {id:'m2-zigzag',name:'锯齿穿梭',emoji:'⚡',cat:'表情包',keys:'锯齿 穿梭',
    fn:t=>{const p=t*PI*6;return{x:sin(p)*18,y:sin(p*2)*8,rotation:sin(p)*6};}},
  {id:'m2-crash-entry',name:'破空而至',emoji:'☄️',cat:'表情包',keys:'破空 入',
    fn:t=>{if(t<0.22){const p=t/0.22;return{x:-(1-p)*120,y:-(1-p)*60,rotation:(1-p)*-270,scaleX:0.4+p*0.6,scaleY:0.4+p*0.6};}if(t<0.4){const p=(t-0.22)/0.18;const sh=sin(p*PI*10)*5*(1-p);return{x:sh,y:sh*0.4};}return{};}},
  {id:'m2-hover-sway',name:'悬浮摆动',emoji:'🛸',cat:'表情包',keys:'悬浮',
    fn:t=>({y:sin(t*PI*2)*8+sin(t*PI*6)*2,rotation:sin(t*PI*2)*4})},
  {id:'m2-snake-weave',name:'游走蛇形',emoji:'🐍',cat:'表情包',keys:'蛇形',
    fn:t=>({x:sin(t*PI*4)*22,rotation:sin(t*PI*4+PI/2)*12})},
  {id:'m2-rocket-launch',name:'冲天起飞',emoji:'🚀',cat:'表情包',keys:'起飞 冲天',
    fn:t=>{if(t<0.3){const sh=sin(t*PI*30)*3;return{x:sh,scaleY:1+t/0.3*0.12};}const p=(t-0.3)/0.7;return{y:-p*p*80,scaleX:1+p*0.1,scaleY:1+p*0.25,alpha:1-p*0.4};}},

  // ─── 情绪反应 15 ───
  {id:'m2-omg',name:'OMG 震惊',emoji:'😮',cat:'表情包',keys:'omg 震惊',
    fn:t=>{if(t<0.3){const s=1+t/0.3*0.85;return{scaleX:s,scaleY:s};}if(t<0.6)return{scaleX:1.85,scaleY:1.85};const sh=sin((t-0.6)*PI*14)*4*(1-(t-0.6)/0.4);return{scaleX:1.85,scaleY:1.85,x:sh};}},
  {id:'m2-dead-inside',name:'心如死灰',emoji:'💀',cat:'表情包',keys:'心死 emo',
    fn:t=>{const p=sin(t*PI);return{alpha:1-p*0.55,scaleY:1-p*0.12,y:p*6};}},
  {id:'m2-ecstatic',name:'欣喜若狂',emoji:'🤩',cat:'表情包',keys:'狂喜',
    fn:t=>{const p=t*PI*4;const s=1+abs(sin(p))*0.28;return{scaleX:s,scaleY:s,rotation:sin(p*0.5)*18,y:-abs(sin(p))*8};}},
  {id:'m2-sleepy',name:'困得不行',emoji:'😴',cat:'表情包',keys:'困 累',
    fn:t=>{const p=sin(t*PI*2);return{rotation:p*10,y:abs(p)*8,scaleY:1-abs(p)*0.1};}},
  {id:'m2-dizzy',name:'头晕目眩',emoji:'😵‍💫',cat:'表情包',keys:'头晕',
    fn:t=>{const p=t*PI*2;return{x:cos(p*3)*10,y:sin(p*2)*8,rotation:sin(p)*18,scaleX:1+sin(p*4)*0.08,scaleY:1+cos(p*5)*0.08};}},
  {id:'m2-awkward-sway',name:'尴尬扭动',emoji:'😬',cat:'表情包',keys:'尴尬',
    fn:t=>{const p=sin(t*PI*3);return{x:p*7,rotation:p*-6,scaleX:1+abs(p)*0.05};}},
  {id:'m2-facepalm-hide',name:'捂脸害羞',emoji:'🫣',cat:'表情包',keys:'捂脸 害羞',
    fn:t=>{if(t<0.2){return{rotation:-t/0.2*22,y:t/0.2*6,scaleY:1-t/0.2*0.05};}if(t<0.78)return{rotation:-22,y:6,scaleY:0.95};const p=(t-0.78)/0.22;return{rotation:-22+p*22,y:6-p*6,scaleY:0.95+p*0.05};}},
  {id:'m2-frozen-shock',name:'定格惊呆',emoji:'🥶',cat:'表情包',keys:'惊呆 定格',
    fn:t=>{if(t<0.15){const s=1+t/0.15*0.3;return{scaleX:s,scaleY:s};}const sh=(floor(t*50)%2?1:-1)*0.8;return{scaleX:1.3,scaleY:1.3,x:sh,y:sh*0.3};}},
  {id:'m2-aha',name:'恍然大悟',emoji:'💡',cat:'表情包',keys:'悟 懂',
    fn:t=>{if(t<0.4)return{};if(t<0.55){const p=(t-0.4)/0.15;const s=1+p*0.3;return{scaleX:s,scaleY:s,rotation:p*22};}if(t<0.8)return{scaleX:1.3,scaleY:1.3,rotation:22};const p=(t-0.8)/0.2;return{scaleX:1.3-p*0.3,scaleY:1.3-p*0.3,rotation:22-p*22};}},
  {id:'m2-disappointed',name:'失望透顶',emoji:'😞',cat:'表情包',keys:'失望',
    fn:t=>{const p=sin(t*PI);return{y:p*14,scaleY:1-p*0.13,alpha:1-p*0.18};}},
  {id:'m2-rising-rage',name:'情绪爆发',emoji:'😡',cat:'表情包',keys:'爆发 怒',
    fn:t=>{const amp=t*22;const s=floor(t*40);return{x:(rnd(s)-0.5)*amp,y:(rnd(s+7)-0.5)*amp*0.7,rotation:(rnd(s+13)-0.5)*amp*0.6,scaleX:1+t*0.2,scaleY:1+t*0.2};}},
  {id:'m2-furious-roar',name:'狂怒咆哮',emoji:'👹',cat:'表情包',keys:'狂怒 咆哮',
    fn:t=>{const sh=sin(t*PI*22)*5;const s=1+abs(sin(t*PI*4))*0.22;return{x:sh,y:cos(t*PI*19)*4,rotation:sh*0.5,scaleX:s,scaleY:s};}},
  {id:'m2-smug-tilt',name:'冷笑不屑',emoji:'😏',cat:'表情包',keys:'冷笑 不屑',
    fn:t=>{const p=sin(t*PI*2);return{rotation:p*16,x:-p*5,scaleX:1+abs(p)*0.06};}},
  {id:'m2-inner-chatter',name:'内心戏多',emoji:'💭',cat:'表情包',keys:'内心',
    fn:t=>{const s=floor(t*15);return{x:(rnd(s)-0.5)*5,y:(rnd(s+3)-0.5)*3,rotation:(rnd(s+7)-0.5)*5};}},
  {id:'m2-shy-twirl',name:'含羞带怯',emoji:'🥺',cat:'表情包',keys:'含羞',
    fn:t=>{const p=sin(t*PI*2);return{x:p*5,rotation:p*-8,scaleX:1-abs(p)*0.05,alpha:1-abs(p)*0.1};}},

  // ─── 动作手势 10 ───
  {id:'m2-deep-bow',name:'深情鞠躬',emoji:'🙇',cat:'表情包',keys:'鞠躬',
    fn:t=>{if(t<0.3){return{rotation:t/0.3*32,y:t/0.3*10};}if(t<0.7)return{rotation:32,y:10};const p=(t-0.7)/0.3;return{rotation:32-p*32,y:10-p*10};}},
  {id:'m2-worship',name:'膜拜大佬',emoji:'🙏',cat:'表情包',keys:'膜拜',
    fn:t=>{const p=abs(sin(t*PI*3));return{y:10-p*20,rotation:-p*22};}},
  {id:'m2-hide-peek',name:'躲猫猫',emoji:'🫥',cat:'表情包',keys:'躲',
    fn:t=>{if(t<0.3){const p=t/0.3;return{scaleX:1-p*0.85,scaleY:1-p*0.85,alpha:1-p*0.9};}if(t<0.55)return{scaleX:0.15,scaleY:0.15,alpha:0.1};const p=(t-0.55)/0.45;return{scaleX:0.15+p*0.85,scaleY:0.15+p*0.85,alpha:0.1+p*0.9};}},
  {id:'m2-blow-kiss',name:'飞吻发射',emoji:'😘',cat:'表情包',keys:'飞吻',
    fn:t=>{if(t<0.25){return{scaleX:1-t/0.25*0.08,scaleY:1-t/0.25*0.08,rotation:-t/0.25*12};}const p=(t-0.25)/0.75;return{x:p*p*70,y:-p*p*30,rotation:-12+p*22,scaleX:0.92-p*0.3,scaleY:0.92-p*0.3,alpha:1-p};}},
  {id:'m2-wave-bye',name:'挥手拜拜',emoji:'👋',cat:'表情包',keys:'拜拜',
    fn:t=>{const p=sin(t*PI*6);const fade=t>0.5?1-(t-0.5)*2:1;return{rotation:p*22,x:p*8,alpha:fade};}},
  {id:'m2-bear-hug',name:'大力熊抱',emoji:'🤗',cat:'表情包',keys:'熊抱',
    fn:t=>{const p=sin(t*PI);return{scaleX:1+p*0.45,scaleY:1+p*0.3,rotation:sin(t*PI*4)*3};}},
  {id:'m2-high-knee',name:'高抬腿',emoji:'🏃',cat:'表情包',keys:'抬腿',
    fn:t=>{const p=abs(sin(t*PI*4));return{y:-p*16,rotation:sin(t*PI*4)*8,scaleY:1-p*0.06};}},
  {id:'m2-flying-kick',name:'飞踹一脚',emoji:'🦵',cat:'表情包',keys:'踹',
    fn:t=>{if(t<0.2){return{x:-(1-t/0.2)*60,rotation:(1-t/0.2)*-30};}if(t<0.4){const p=(t-0.2)/0.2;return{x:p*40,rotation:p*48};}if(t<0.65)return{x:40,rotation:48};const p=(t-0.65)/0.35;return{x:40-p*40,rotation:48-p*48};}},
  {id:'m2-shrug',name:'摊手耸肩',emoji:'🤷',cat:'表情包',keys:'摊手',
    fn:t=>{const p=sin(t*PI);return{scaleX:1+p*0.32,rotation:p*-5,y:-p*3};}},
  {id:'m2-kneel-down',name:'跪下投降',emoji:'🧎',cat:'表情包',keys:'跪',
    fn:t=>{if(t<0.3){return{y:t/0.3*18,scaleY:1-t/0.3*0.17,rotation:(t/0.3)*-9};}if(t<0.7)return{y:18,scaleY:0.83,rotation:-9};const p=(t-0.7)/0.3;return{y:18-p*18,scaleY:0.83+p*0.17,rotation:-9+p*9};}},

  // ─── 物理/故障 10 ───
  {id:'m2-elastic-land',name:'弹性落地',emoji:'🎾',cat:'表情包',keys:'落地 弹',
    fn:t=>{if(t<0.3){return{y:-(0.3-t)/0.3*45};}const p=(t-0.3)/0.7;const bounce=abs(sin(p*PI*3))*exp(-p*3);return{y:-bounce*22,scaleY:1-bounce*0.18,scaleX:1+bounce*0.12};}},
  {id:'m2-rubberband',name:'橡皮筋拉',emoji:'🏹',cat:'表情包',keys:'橡皮筋 拉',
    fn:t=>{if(t<0.4){const p=t/0.4;return{x:-p*45,scaleX:1+p*0.3,scaleY:1-p*0.15};}const p=(t-0.4)/0.6;const sp=sin(p*PI*4)*exp(-p*3);return{x:-45+p*90+sp*22,scaleX:1.3-p*0.3+sp*0.1};}},
  {id:'m2-tornado-suck',name:'漩涡吸入',emoji:'🌪️',cat:'表情包',keys:'漩涡 吸',
    fn:t=>{const r=t*PI*4;const rad=(1-t)*35;return{x:cos(r)*rad,y:sin(r)*rad,rotation:t*720,scaleX:1-t*0.45,scaleY:1-t*0.45,alpha:1-t*0.3};}},
  {id:'m2-pingpong',name:'乒乓往返',emoji:'🏓',cat:'表情包',keys:'乒乓',
    fn:t=>{const p=t*PI*4;return{x:sin(p)*28,rotation:sin(p+PI/2)*15};}},
  {id:'m2-quantum-jump',name:'量子跳跃',emoji:'⚛️',cat:'表情包',keys:'量子',
    fn:t=>{const s=floor(t*8);return{x:(rnd(s)-0.5)*35,y:(rnd(s+11)-0.5)*22,alpha:floor(t*40)%2?1:0.35};}},
  {id:'m2-after-image',name:'多重残影',emoji:'👥',cat:'表情包',keys:'残影',
    fn:t=>{const p=t*PI*6;return{x:sin(p)*22,alpha:0.65+sin(p)*0.35};}},
  {id:'m2-heavy-glitch',name:'严重故障',emoji:'📺',cat:'表情包',keys:'故障 glitch',
    fn:t=>{const s=floor(t*25);return{x:(rnd(s)-0.5)*22,y:(rnd(s+5)-0.5)*8,scaleX:1+(rnd(s+11)-0.5)*0.3,alpha:rnd(s+17)>0.85?0.3:1};}},
  {id:'m2-flash-in',name:'闪光登场',emoji:'⚡',cat:'表情包',keys:'闪光',
    fn:t=>{if(t<0.15){return{alpha:floor(t*30)%2?1:0.2,scaleX:0.4+t/0.15*0.6,scaleY:0.4+t/0.15*0.6};}if(t<0.3){const p=(t-0.15)/0.15;const s=1+sin(p*PI*6)*0.12;return{scaleX:s,scaleY:s};}return{};}},
  {id:'m2-dual-ghost',name:'重影分离',emoji:'👻',cat:'表情包',keys:'重影',
    fn:t=>({x:sin(t*PI*8)*13,alpha:0.7+sin(t*PI*16)*0.3})},
  {id:'m2-hyper-freq',name:'超频振动',emoji:'⚡',cat:'表情包',keys:'超频',
    fn:t=>({x:sin(t*PI*40)*3.5,y:cos(t*PI*43)*3,scaleX:1+sin(t*PI*40)*0.025})},

  // ─── 史诗/炫酷 5 ───
  {id:'m2-slow-mo',name:'慢镜回放',emoji:'🎬',cat:'表情包',keys:'慢镜 慢动作',
    fn:t=>{const ease=1-pow(1-t,3);const p=sin(ease*PI);return{x:p*15,scaleX:1+p*0.15,scaleY:1+p*0.15,rotation:p*6};}},
  {id:'m2-hyper-dash',name:'光速冲刺',emoji:'💨',cat:'表情包',keys:'光速',
    fn:t=>{const cycle=(t*2)%1;if(cycle<0.05)return{x:-80,alpha:0};if(cycle<0.1){const p=(cycle-0.05)/0.05;return{x:-80+p*160,alpha:p};}if(cycle<0.3)return{x:80,alpha:1};if(cycle<0.35){const p=(cycle-0.3)/0.05;return{x:80-p*80,alpha:1};}return{};}},
  {id:'m2-epic-entry',name:'史诗登场',emoji:'🎭',cat:'表情包',keys:'史诗 登场',
    fn:t=>{if(t<0.3){const p=t/0.3;return{x:(1-p)*150,rotation:(1-p)*360,scaleX:2-p,scaleY:2-p,alpha:p};}if(t<0.5){const p=(t-0.3)/0.2;const sh=sin(p*PI*10)*8*(1-p);return{x:sh,y:sh*0.5,scaleX:1+(1-p)*0.2,scaleY:1+(1-p)*0.2};}return{};}},
  {id:'m2-legendary-aura',name:'传说威压',emoji:'👑',cat:'表情包',keys:'传说',
    fn:t=>{const s=1.08+sin(t*PI*2)*0.07;const p=sin(t*PI*2);return{scaleX:s,scaleY:s,alpha:0.75+abs(p)*0.25,y:p*-2};}},
  {id:'m2-boss-battle',name:'Boss 战',emoji:'🐲',cat:'表情包',keys:'boss',
    fn:t=>{const sh=sin(t*PI*12)*3;const s=1+abs(sin(t*PI*2))*0.18;return{x:sh,y:cos(t*PI*12)*2,rotation:sh*0.3,scaleX:s,scaleY:s};}}
];

// 分类
const CATEGORIES = ['全部','⭐收藏','表情包','渐变','移动','缩放','旋转','组合','扭曲','可爱','自定义'];

// ═══════════════════════════════════════════════════════════
//  30 个特效叠加（粒子/覆盖系统）
// ═══════════════════════════════════════════════════════════

// 辅助：绘制心形
function drawHeart(ctx,x,y,size){
  ctx.beginPath();
  const s=size;
  ctx.moveTo(x,y+s*0.3);
  ctx.bezierCurveTo(x,y-s*0.1,x-s*0.5,y-s*0.1,x-s*0.5,y+s*0.3);
  ctx.bezierCurveTo(x-s*0.5,y+s*0.6,x-s*0.25,y+s*0.8,x,y+s);
  ctx.bezierCurveTo(x+s*0.25,y+s*0.8,x+s*0.5,y+s*0.6,x+s*0.5,y+s*0.3);
  ctx.bezierCurveTo(x+s*0.5,y-s*0.1,x,y-s*0.1,x,y+s*0.3);
  ctx.fill();
}
// 叶子形
function drawLeaf(ctx,x,y,size,color){
  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.ellipse(x,y,size*0.4,size,0,0,PI*2);
  ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.2)';
  ctx.lineWidth=0.5;
  ctx.beginPath();
  ctx.moveTo(x,y-size);
  ctx.lineTo(x,y+size);
  ctx.stroke();
}
// 星形
function drawStar(ctx,x,y,r,points=5){
  ctx.beginPath();
  for(let i=0;i<points*2;i++){
    const ang=(i*PI)/points-PI/2;
    const rr=i%2===0?r:r*0.45;
    const px=x+cos(ang)*rr,py=y+sin(ang)*rr;
    if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
  }
  ctx.closePath();ctx.fill();
}
// 花瓣
function drawPetal(ctx,x,y,size,rotation,color){
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(rotation);
  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.ellipse(0,0,size*0.35,size,0,0,PI*2);
  ctx.fill();
  ctx.restore();
}
// 蝴蝶
function drawButterfly(ctx,x,y,size,flap,color){
  ctx.save();
  ctx.translate(x,y);
  const w=size*(0.7+flap*0.5);
  ctx.fillStyle=color;
  // 左翅
  ctx.beginPath();
  ctx.ellipse(-w*0.5,-size*0.2,w*0.45,size*0.45,-0.3,0,PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-w*0.4,size*0.2,w*0.35,size*0.3,0.2,0,PI*2);
  ctx.fill();
  // 右翅
  ctx.beginPath();
  ctx.ellipse(w*0.5,-size*0.2,w*0.45,size*0.45,0.3,0,PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w*0.4,size*0.2,w*0.35,size*0.3,-0.2,0,PI*2);
  ctx.fill();
  // 身体
  ctx.fillStyle='#333';
  ctx.fillRect(-size*0.05,-size*0.4,size*0.1,size*0.8);
  ctx.restore();
}

const SPECIAL_EFFECTS = [
  {id:'leaves',name:'飘落叶',emoji:'🍂',desc:'秋天的落叶',
    draw:(ctx,t,w,h)=>{
      const colors=['#d97706','#b45309','#78350f','#a16207','#ea580c'];
      const N=18;
      for(let i=0;i<N;i++){
        const phase=i/N,speed=0.6+(i*7%11)/11*0.6;
        const rawY=(t*speed+phase)%1;
        const y=rawY*(h+40)-20;
        const x=((i*73%N)/N)*w+sin(t*PI*3+i*2.1)*30;
        const rot=t*180+i*40;
        const size=7+(i*3%6);
        ctx.save();ctx.globalAlpha=0.85;
        ctx.translate(x,y);ctx.rotate(rot*PI/180);
        drawLeaf(ctx,0,0,size,colors[i%colors.length]);
        ctx.restore();
      }
    }},
  {id:'hearts',name:'飘爱心',emoji:'💕',desc:'满屏爱心',
    draw:(ctx,t,w,h)=>{
      const colors=['#ec4899','#f472b6','#db2777','#be185d','#f9a8d4'];
      const N=20;
      for(let i=0;i<N;i++){
        const phase=i/N,speed=0.7+(i*5%9)/9*0.5;
        const rawY=1-((t*speed+phase)%1);
        const y=rawY*(h+40)-20;
        const x=((i*53%N)/N)*w+sin(t*PI*2+i*1.7)*20;
        const size=9+(i*2%5);
        const flutter=1+sin(t*PI*6+i)*0.15;
        ctx.save();ctx.globalAlpha=0.9;
        ctx.fillStyle=colors[i%colors.length];
        drawHeart(ctx,x-size/2,y-size/2,size*flutter);
        ctx.restore();
      }
    }},
  {id:'snow',name:'飘雪',emoji:'❄️',desc:'冬季雪花',
    draw:(ctx,t,w,h)=>{
      const N=40;
      for(let i=0;i<N;i++){
        const phase=i/N,speed=0.5+(i*3%7)/7*0.7;
        const rawY=(t*speed+phase)%1;
        const y=rawY*(h+20)-10;
        const x=((i*97%N)/N)*w+sin(t*PI*2+i)*15;
        const size=1.5+(i%4);
        ctx.save();ctx.globalAlpha=0.8;
        ctx.fillStyle='#fff';
        ctx.beginPath();ctx.arc(x,y,size,0,PI*2);ctx.fill();
        ctx.restore();
      }
    }},
  {id:'rain',name:'下雨',emoji:'🌧️',desc:'倾盆大雨',
    draw:(ctx,t,w,h)=>{
      const N=60;
      ctx.save();ctx.strokeStyle='rgba(130,180,230,.6)';ctx.lineWidth=1.5;
      for(let i=0;i<N;i++){
        const phase=i/N,speed=1.5+(i%5)*0.3;
        const rawY=(t*speed+phase)%1;
        const y=rawY*(h+30)-20;
        const x=((i*43%N)/N)*w;
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-3,y+10);ctx.stroke();
      }
      ctx.restore();
    }},
  {id:'thunder',name:'打雷闪电',emoji:'⚡',desc:'电闪雷鸣',
    draw:(ctx,t,w,h)=>{
      const flashes=[0.1,0.35,0.6,0.8];
      let flash=0;
      for(const f of flashes){if(abs(t-f)<0.04)flash=1-abs(t-f)/0.04;}
      if(flash>0){
        ctx.save();ctx.fillStyle=`rgba(255,255,255,${flash*0.5})`;
        ctx.fillRect(0,0,w,h);
        ctx.strokeStyle=`rgba(255,255,200,${flash})`;ctx.lineWidth=3;
        const seed=floor(t*10);
        ctx.beginPath();
        let x=w*(0.3+rnd(seed)*0.4),y=0;
        ctx.moveTo(x,y);
        while(y<h){
          y+=15+rnd(seed+y)*10;
          x+=(rnd(seed+y+1)-0.5)*30;
          ctx.lineTo(x,y);
        }
        ctx.stroke();ctx.restore();
      }
    }},
  {id:'explosion',name:'爆炸粒子',emoji:'💥',desc:'爆炸四溅',
    draw:(ctx,t,w,h)=>{
      const cx=w/2,cy=h/2;
      const N=30;
      const burst=(t%0.5)/0.5;
      ctx.save();
      for(let i=0;i<N;i++){
        const angle=(i/N)*PI*2+floor(t*2)*0.3;
        const dist=burst*(h*0.6);
        const x=cx+cos(angle)*dist;
        const y=cy+sin(angle)*dist;
        const size=(1-burst)*6+2;
        ctx.globalAlpha=(1-burst)*0.9;
        ctx.fillStyle=['#ff6b35','#f7931e','#ffb627','#ff4500'][i%4];
        ctx.beginPath();ctx.arc(x,y,size,0,PI*2);ctx.fill();
      }
      ctx.restore();
    }},
  {id:'cracks',name:'裂开',emoji:'💔',desc:'裂纹扩散',
    draw:(ctx,t,w,h)=>{
      if(t<0.1)return;
      const p=min((t-0.1)/0.5,1);
      const cx=w/2,cy=h/2;
      ctx.save();
      ctx.strokeStyle=`rgba(30,30,40,${p*0.8})`;
      for(let i=0;i<8;i++){
        const angle=(i/8)*PI*2+rnd(i)*0.3;
        const len=p*(w*0.4);
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.moveTo(cx,cy);
        let x=cx,y=cy;
        const steps=6;
        for(let s=1;s<=steps;s++){
          const sp=s/steps;
          x=cx+cos(angle+(rnd(i*10+s)-0.5)*0.5)*len*sp;
          y=cy+sin(angle+(rnd(i*10+s)-0.5)*0.5)*len*sp;
          ctx.lineTo(x,y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }},
  {id:'fireworks',name:'烟花',emoji:'🎆',desc:'绚烂烟花',
    draw:(ctx,t,w,h)=>{
      const bursts=[{t:0.2,x:0.3,c:'#ff006e'},{t:0.5,x:0.7,c:'#fb5607'},{t:0.8,x:0.5,c:'#8338ec'}];
      ctx.save();
      for(const b of bursts){
        const bt=(t-b.t+1)%1;
        if(bt>0.4)continue;
        const cx=b.x*w,cy=h*0.35;
        const N=20;
        for(let i=0;i<N;i++){
          const angle=(i/N)*PI*2;
          const dist=bt*h*0.4;
          const x=cx+cos(angle)*dist;
          const y=cy+sin(angle)*dist+bt*bt*h*0.2;
          const a=(1-bt/0.4);
          ctx.globalAlpha=a;ctx.fillStyle=b.c;
          ctx.beginPath();ctx.arc(x,y,2,0,PI*2);ctx.fill();
        }
      }
      ctx.restore();
    }},
  {id:'bubbles',name:'气泡上升',emoji:'🫧',desc:'水下气泡',
    draw:(ctx,t,w,h)=>{
      const N=20;
      ctx.save();
      for(let i=0;i<N;i++){
        const phase=i/N,speed=0.4+(i%5)*0.15;
        const rawY=1-((t*speed+phase)%1);
        const y=rawY*(h+20)-10;
        const x=((i*37%N)/N)*w+sin(t*PI*2+i)*8;
        const size=4+(i%6);
        ctx.globalAlpha=0.4;
        ctx.strokeStyle='#7dd3fc';ctx.lineWidth=1.5;
        ctx.fillStyle='rgba(125,211,252,.2)';
        ctx.beginPath();ctx.arc(x,y,size,0,PI*2);ctx.fill();ctx.stroke();
      }
      ctx.restore();
    }},
  {id:'sparkle',name:'星星闪烁',emoji:'✨',desc:'星光璀璨',
    draw:(ctx,t,w,h)=>{
      const N=25;
      ctx.save();ctx.fillStyle='#fff59d';
      for(let i=0;i<N;i++){
        const twinkle=sin(t*PI*4+i*1.3);
        if(twinkle<0)continue;
        const x=((i*79%N)/N)*w;
        const y=((i*41%N)/N)*h;
        const size=twinkle*4+1;
        ctx.globalAlpha=twinkle;
        drawStar(ctx,x,y,size,4);
      }
      ctx.restore();
    }},
  {id:'fire',name:'火焰',emoji:'🔥',desc:'熊熊烈火',
    draw:(ctx,t,w,h)=>{
      const N=25;
      ctx.save();
      for(let i=0;i<N;i++){
        const phase=i/N,speed=1.2+(i%4)*0.2;
        const rawY=1-((t*speed+phase)%1);
        const y=rawY*(h+20)-10+h*0.5;
        const x=w/2+sin(t*PI*4+i*1.7)*w*0.35;
        const size=(1-rawY)*12+3;
        const a=(1-rawY)*0.8;
        ctx.globalAlpha=a;
        ctx.fillStyle=rawY<0.5?'#ffd700':rawY<0.8?'#ff6b35':'#c1121f';
        ctx.beginPath();ctx.arc(x,y,size,0,PI*2);ctx.fill();
      }
      ctx.restore();
    }},
  {id:'smoke',name:'烟雾',emoji:'💨',desc:'飘散烟雾',
    draw:(ctx,t,w,h)=>{
      const N=15;
      ctx.save();
      for(let i=0;i<N;i++){
        const phase=i/N,speed=0.3+(i%3)*0.1;
        const rawY=1-((t*speed+phase)%1);
        const y=rawY*h;
        const x=w/2+sin(t*PI+i)*w*0.3+(rawY*30-15);
        const size=20+rawY*40;
        ctx.globalAlpha=(1-rawY)*0.3;
        ctx.fillStyle='#888';
        ctx.beginPath();ctx.arc(x,y,size,0,PI*2);ctx.fill();
      }
      ctx.restore();
    }},
  {id:'rainbow',name:'彩虹',emoji:'🌈',desc:'七色彩虹',
    draw:(ctx,t,w,h)=>{
      const colors=['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899'];
      const p=sin(t*PI);
      ctx.save();ctx.globalAlpha=0.5*p;
      ctx.lineWidth=5;
      for(let i=0;i<colors.length;i++){
        ctx.strokeStyle=colors[i];
        ctx.beginPath();
        ctx.arc(w/2,h,w*0.4-i*5,PI,PI*2);
        ctx.stroke();
      }
      ctx.restore();
    }},
  {id:'confetti',name:'彩纸飘落',emoji:'🎊',desc:'庆祝彩纸',
    draw:(ctx,t,w,h)=>{
      const colors=['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899'];
      const N=35;
      for(let i=0;i<N;i++){
        const phase=i/N,speed=0.7+(i*3%7)/7*0.6;
        const rawY=(t*speed+phase)%1;
        const y=rawY*(h+20)-10;
        const x=((i*67%N)/N)*w+sin(t*PI*3+i)*18;
        const rot=t*300+i*30;
        const size=4+(i%4)*2;
        ctx.save();ctx.globalAlpha=0.9;
        ctx.translate(x,y);ctx.rotate(rot*PI/180);
        ctx.fillStyle=colors[i%colors.length];
        ctx.fillRect(-size/2,-size/4,size,size/2);
        ctx.restore();
      }
    }},
  {id:'petals',name:'花瓣飘落',emoji:'🌸',desc:'樱花花瓣',
    draw:(ctx,t,w,h)=>{
      const colors=['#fbcfe8','#f9a8d4','#f472b6','#fda4af'];
      const N=22;
      for(let i=0;i<N;i++){
        const phase=i/N,speed=0.4+(i*5%11)/11*0.4;
        const rawY=(t*speed+phase)%1;
        const y=rawY*(h+30)-15;
        const x=((i*83%N)/N)*w+sin(t*PI*2+i*1.5)*25;
        const rot=t*150+i*45;
        const size=5+(i%4);
        ctx.globalAlpha=0.85;
        drawPetal(ctx,x,y,size,rot*PI/180,colors[i%colors.length]);
      }
      ctx.globalAlpha=1;
    }},
  {id:'fireflies',name:'萤火虫',emoji:'💫',desc:'夜晚萤火',
    draw:(ctx,t,w,h)=>{
      const N=15;
      ctx.save();
      for(let i=0;i<N;i++){
        const p=t*PI*2+i;
        const x=(((i*53%N)/N)*w+cos(p*0.7)*40+w)%w;
        const y=(((i*31%N)/N)*h+sin(p*0.9)*30+h)%h;
        const pulse=sin(t*PI*5+i*2)*0.5+0.5;
        ctx.globalAlpha=pulse*0.9;
        const grad=ctx.createRadialGradient(x,y,0,x,y,12);
        grad.addColorStop(0,'#fef08a');
        grad.addColorStop(0.4,'rgba(250,204,21,.6)');
        grad.addColorStop(1,'rgba(250,204,21,0)');
        ctx.fillStyle=grad;
        ctx.beginPath();ctx.arc(x,y,12,0,PI*2);ctx.fill();
        ctx.globalAlpha=pulse;
        ctx.fillStyle='#fef3c7';
        ctx.beginPath();ctx.arc(x,y,1.5,0,PI*2);ctx.fill();
      }
      ctx.restore();
    }},
  {id:'butterflies',name:'蝴蝶',emoji:'🦋',desc:'翩翩起舞',
    draw:(ctx,t,w,h)=>{
      const colors=['#ec4899','#8b5cf6','#3b82f6','#f59e0b'];
      const N=5;
      for(let i=0;i<N;i++){
        const p=t*PI*2+i*1.2;
        const x=w/2+cos(p*0.8+i)*w*0.35;
        const y=h/2+sin(p*1.1+i)*h*0.3+sin(t*PI*4+i)*10;
        const flap=sin(t*PI*12+i*2)*0.5+0.5;
        drawButterfly(ctx,x,y,14,flap,colors[i%colors.length]);
      }
    }},
  {id:'meteors',name:'流星',emoji:'☄️',desc:'划破天际',
    draw:(ctx,t,w,h)=>{
      const N=6;
      ctx.save();
      for(let i=0;i<N;i++){
        const phase=i/N,speed=1.2+(i%3)*0.4;
        const rawT=(t*speed+phase)%1;
        const sx=-20,sy=-20;
        const ex=w*(0.4+i*0.15),ey=h*0.7;
        const x=sx+(ex-sx)*rawT;
        const y=sy+(ey-sy)*rawT;
        ctx.globalAlpha=0.7*(1-rawT*0.5);
        const grad=ctx.createLinearGradient(x,y,x-40,y-40);
        grad.addColorStop(0,'#fef08a');
        grad.addColorStop(1,'rgba(250,204,21,0)');
        ctx.strokeStyle=grad;ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-40,y-40);ctx.stroke();
        ctx.fillStyle='#fef3c7';
        ctx.beginPath();ctx.arc(x,y,2.5,0,PI*2);ctx.fill();
      }
      ctx.restore();
    }},
  {id:'magic',name:'魔法粒子',emoji:'🪄',desc:'魔法光尘',
    draw:(ctx,t,w,h)=>{
      const N=35;
      ctx.save();
      for(let i=0;i<N;i++){
        const angle=t*PI*2*(0.5+(i%3)*0.2)+i;
        const rad=30+((i*7)%100);
        const x=w/2+cos(angle)*rad;
        const y=h/2+sin(angle)*rad;
        const size=1+sin(t*PI*6+i)*1.5+1;
        const hue=(t*180+i*20)%360;
        ctx.globalAlpha=0.7+sin(t*PI*4+i)*0.3;
        ctx.fillStyle=`hsl(${hue},100%,70%)`;
        ctx.beginPath();ctx.arc(x,y,size,0,PI*2);ctx.fill();
      }
      ctx.restore();
    }},
  {id:'matrix',name:'数字雨',emoji:'💻',desc:'黑客帝国',
    draw:(ctx,t,w,h)=>{
      const cols=20;
      ctx.save();ctx.font='bold 14px monospace';
      for(let i=0;i<cols;i++){
        const speed=0.8+(i%4)*0.3;
        const rawY=(t*speed+i*0.1)%1;
        const y=rawY*(h+50);
        const x=(i/cols)*w;
        for(let j=0;j<8;j++){
          const ty=y-j*16;
          if(ty<0||ty>h)continue;
          const char=String.fromCharCode(0x30A0+floor(rnd(i*100+j+floor(t*10))*96));
          ctx.globalAlpha=(j===0?1:(1-j*0.12))*0.8;
          ctx.fillStyle=j===0?'#86efac':'#22c55e';
          ctx.fillText(char,x,ty);
        }
      }
      ctx.restore();
    }},
  {id:'music-notes',name:'音符漂浮',emoji:'🎵',desc:'音乐跳动',
    draw:(ctx,t,w,h)=>{
      const notes=['♪','♫','♩','♬','𝄞'];
      const N=12;
      ctx.save();ctx.font='bold 22px serif';
      for(let i=0;i<N;i++){
        const phase=i/N,speed=0.5+(i%3)*0.2;
        const rawY=1-((t*speed+phase)%1);
        const y=rawY*(h+20)-10;
        const x=((i*71%N)/N)*w+sin(t*PI*3+i)*20;
        ctx.globalAlpha=0.75;
        ctx.fillStyle=['#ec4899','#8b5cf6','#3b82f6','#f59e0b'][i%4];
        ctx.fillText(notes[i%notes.length],x,y);
      }
      ctx.restore();
    }},
  {id:'shockwave-ring',name:'冲击波环',emoji:'💫',desc:'能量冲击',
    draw:(ctx,t,w,h)=>{
      const rings=[(t)%1,(t+0.33)%1,(t+0.66)%1];
      ctx.save();
      for(const r of rings){
        ctx.globalAlpha=(1-r)*0.5;
        ctx.strokeStyle='#60a5fa';ctx.lineWidth=3;
        ctx.beginPath();
        ctx.arc(w/2,h/2,r*min(w,h)*0.5,0,PI*2);
        ctx.stroke();
      }
      ctx.restore();
    }},
  {id:'energy-field',name:'能量场',emoji:'⚡',desc:'电弧能量',
    draw:(ctx,t,w,h)=>{
      ctx.save();ctx.strokeStyle='rgba(125,211,252,.7)';ctx.lineWidth=1.5;
      const N=6;
      for(let i=0;i<N;i++){
        const seed=floor(t*20)+i*100;
        ctx.beginPath();
        let x=rnd(seed)*w,y=rnd(seed+1)*h;
        ctx.moveTo(x,y);
        for(let s=0;s<5;s++){
          x+=(rnd(seed+s*2)-0.5)*40;
          y+=(rnd(seed+s*3)-0.5)*40;
          ctx.lineTo(x,y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }},
  {id:'lens-flare',name:'眩光',emoji:'🌟',desc:'镜头光晕',
    draw:(ctx,t,w,h)=>{
      const x=w*(0.2+sin(t*PI*2)*0.3),y=h*(0.3+cos(t*PI*2)*0.2);
      ctx.save();
      const grad=ctx.createRadialGradient(x,y,0,x,y,80);
      grad.addColorStop(0,'rgba(255,255,220,.8)');
      grad.addColorStop(0.3,'rgba(255,220,100,.3)');
      grad.addColorStop(1,'rgba(255,220,100,0)');
      ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
      // 光斑
      for(let i=1;i<=4;i++){
        const fx=w/2+(x-w/2)*-i*0.4;
        const fy=h/2+(y-h/2)*-i*0.4;
        ctx.globalAlpha=0.3;
        const g2=ctx.createRadialGradient(fx,fy,0,fx,fy,20);
        g2.addColorStop(0,'rgba(255,220,150,.6)');
        g2.addColorStop(1,'rgba(255,220,150,0)');
        ctx.fillStyle=g2;
        ctx.beginPath();ctx.arc(fx,fy,20,0,PI*2);ctx.fill();
      }
      ctx.restore();
    }},
  {id:'glitch-lines',name:'故障条纹',emoji:'👾',desc:'故障艺术',
    draw:(ctx,t,w,h)=>{
      const seed=floor(t*12);
      ctx.save();
      for(let i=0;i<5;i++){
        const y=rnd(seed+i)*h;
        const hh=3+rnd(seed+i+10)*8;
        const hue=rnd(seed+i+20)*360;
        ctx.globalAlpha=0.4;
        ctx.fillStyle=`hsl(${hue},100%,60%)`;
        ctx.fillRect(0,y,w,hh);
      }
      ctx.restore();
    }},
  {id:'vortex-p',name:'漩涡粒子',emoji:'🌀',desc:'吸入漩涡',
    draw:(ctx,t,w,h)=>{
      const N=30;
      ctx.save();
      for(let i=0;i<N;i++){
        const phase=i/N;
        const lifeT=(t+phase)%1;
        const angle=lifeT*PI*6+i;
        const dist=(1-lifeT)*min(w,h)*0.4;
        const x=w/2+cos(angle)*dist;
        const y=h/2+sin(angle)*dist;
        const size=(1-lifeT)*4+1;
        ctx.globalAlpha=(1-lifeT)*0.8;
        ctx.fillStyle=`hsl(${260+i*5},80%,60%)`;
        ctx.beginPath();ctx.arc(x,y,size,0,PI*2);ctx.fill();
      }
      ctx.restore();
    }},
  {id:'pixelate',name:'像素马赛克',emoji:'🎮',desc:'像素效果',
    draw:(ctx,t,w,h)=>{
      const p=sin(t*PI)*0.4;
      if(p<=0)return;
      const size=max(4,floor(16*p));
      ctx.save();ctx.globalAlpha=p*0.5;
      for(let y=0;y<h;y+=size){
        for(let x=0;x<w;x+=size){
          if(rnd(x*31+y*17+floor(t*8))>0.7){
            ctx.fillStyle=`hsla(${(x+y+t*200)%360},70%,60%,.5)`;
            ctx.fillRect(x,y,size-1,size-1);
          }
        }
      }
      ctx.restore();
    }},
  {id:'candy',name:'糖果雨',emoji:'🍬',desc:'甜蜜糖果',
    draw:(ctx,t,w,h)=>{
      const colors=['#f472b6','#facc15','#60a5fa','#4ade80','#c084fc'];
      const N=20;
      for(let i=0;i<N;i++){
        const phase=i/N,speed=0.7+(i%4)*0.15;
        const rawY=(t*speed+phase)%1;
        const y=rawY*(h+20)-10;
        const x=((i*59%N)/N)*w+sin(t*PI*2+i)*12;
        const rot=t*180+i*30;
        ctx.save();ctx.globalAlpha=0.9;
        ctx.translate(x,y);ctx.rotate(rot*PI/180);
        ctx.fillStyle=colors[i%colors.length];
        ctx.fillRect(-7,-4,14,8);
        ctx.fillStyle='rgba(255,255,255,.5)';
        ctx.fillRect(-7,-4,14,2);
        ctx.restore();
      }
    }},
  {id:'light-rings',name:'光圈',emoji:'⭕',desc:'扩散光环',
    draw:(ctx,t,w,h)=>{
      ctx.save();
      for(let i=0;i<3;i++){
        const lt=(t+i*0.33)%1;
        ctx.globalAlpha=(1-lt)*0.6;
        ctx.strokeStyle=`hsl(${180+i*60},80%,70%)`;
        ctx.lineWidth=2+(1-lt)*3;
        ctx.beginPath();
        ctx.arc(w/2,h/2,lt*min(w,h)*0.6,0,PI*2);
        ctx.stroke();
      }
      ctx.restore();
    }},
  {id:'cherry-blossom',name:'樱花飘落',emoji:'🌸',desc:'樱花纷飞',
    draw:(ctx,t,w,h)=>{
      const N=30;
      for(let i=0;i<N;i++){
        const phase=i/N,speed=0.35+(i*7%13)/13*0.4;
        const rawY=(t*speed+phase)%1;
        const y=rawY*(h+20)-10;
        const x=((i*79%N)/N)*w+sin(t*PI*1.5+i*1.3)*35;
        const size=4+(i%5);
        const rot=t*120+i*50;
        ctx.save();ctx.globalAlpha=0.8;
        ctx.translate(x,y);ctx.rotate(rot*PI/180);
        // 5瓣樱花
        ctx.fillStyle=i%3===0?'#fbcfe8':'#f9a8d4';
        for(let p=0;p<5;p++){
          ctx.save();
          ctx.rotate(p*PI*2/5);
          ctx.beginPath();
          ctx.ellipse(0,-size*0.5,size*0.35,size*0.7,0,0,PI*2);
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle='#eab308';
        ctx.beginPath();ctx.arc(0,0,size*0.2,0,PI*2);ctx.fill();
        ctx.restore();
      }
    }}
];

// ═══════════════════════════════════════════════════════════
//  State
// ═══════════════════════════════════════════════════════════
const LS_EFFECTS_KEY='gif_tool_custom_effects',LS_APIKEY='gif_tool_api_key';
const LS_FAV_ANIM='gif_tool_fav_anim',LS_FAV_SFX='gif_tool_fav_sfx';

function loadFavs(key){try{return JSON.parse(localStorage.getItem(key)||'[]');}catch{return[];}}
function saveFavs(key,list){localStorage.setItem(key,JSON.stringify(list));}
function toggleFav(key,id){
  const list=loadFavs(key);
  const i=list.indexOf(id);
  if(i>=0)list.splice(i,1);else list.push(id);
  saveFavs(key,list);
  return i<0; // true = 新增收藏
}
function isFav(key,id){return loadFavs(key).includes(id);}
const runtimeEffects={};
BUILTIN_EFFECTS.forEach(e=>{runtimeEffects[e.id]=e.fn;});

let imageBitmap=null;
let selectedEffect='fade';
let selectedSfx=null;
let previewRAF=null;
let previewStartT=null;
let aiGeneratedCode='';
let activeCat='全部';
let searchQuery='';
let sfxSearchQuery='';
const PREVIEW_DUR=2500;

// ═══════════════════════════════════════════════════════════
//  DOM references
// ═══════════════════════════════════════════════════════════
const $=id=>document.getElementById(id);
const dropZone=$('drop-zone'),fileInput=$('file-input');
const previewWrap=$('preview-wrap'),thumb=$('thumb');
const fileNameEl=$('file-name-text'),fileSizeEl=$('file-size-text');
const btnReupload=$('btn-reupload');
const durationSel=$('duration-select'),loopToggle=$('loop-toggle');
const sizeSel=$('size-select'),filesizeSel=$('filesize-select');
const bgSel=$('bg-select'),qualitySel=$('quality-select');
const btnGenerate=$('btn-generate');
const progressWrap=$('progress-wrap'),progressBar=$('progress-bar'),progressText=$('progress-text');
const resultWrap=$('result-wrap'),resultImg=$('result-img');
const resultMeta=$('result-meta'),btnDownload=$('btn-download');
const previewCvs=$('preview-canvas'),pCtx=previewCvs.getContext('2d');
const previewEmpty=$('preview-empty');
const offscreen=$('offscreen'),oCtx=offscreen.getContext('2d',{willReadFrequently:true});
// API Key 已经改由 ops-assistant 统一管理,不再需要本地输入
const effectDesc=$('effect-desc'),btnAiGen=$('btn-ai-gen'),aiStatus=$('ai-status');
const aiResult=$('ai-result'),aiCode=$('ai-code');
const effectName=$('effect-name'),btnSave=$('btn-save-effect');
const searchInput=$('effect-search'),searchClear=$('search-clear');
const effectGrid=$('effect-grid'),catTabsEl=$('cat-tabs');
const sfxGrid=$('sfx-grid'),sfxSearch=$('sfx-search');
const selectedAnimName=$('selected-anim-name'),selectedSfxName=$('selected-sfx-name');
const animCountEl=$('anim-count'),sfxCountEl=$('sfx-count');

// ═══════════════════════════════════════════════════════════
//  Tabs
// ═══════════════════════════════════════════════════════════
document.querySelectorAll('.tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    const name=tab.dataset.tab;
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    $('tab-'+name).classList.add('active');
  });
});

// ═══════════════════════════════════════════════════════════
//  动画效果 Grid
// ═══════════════════════════════════════════════════════════
function loadCustomEffects(){try{return JSON.parse(localStorage.getItem(LS_EFFECTS_KEY)||'[]');}catch{return[];}}
function saveCustomEffects(l){localStorage.setItem(LS_EFFECTS_KEY,JSON.stringify(l));}

function getAllEffects(){
  const custom=loadCustomEffects();
  return [...BUILTIN_EFFECTS,...custom.map(c=>({...c,cat:'自定义',emoji:'✏️',keys:'自定义 ai'}))];
}

function getVisibleEffects(){
  let list=getAllEffects();
  if(activeCat==='⭐收藏'){
    const favs=loadFavs(LS_FAV_ANIM);
    list=list.filter(e=>favs.includes(e.id));
  }else if(activeCat!=='全部'){
    list=list.filter(e=>e.cat===activeCat);
  }
  if(searchQuery){
    const q=searchQuery.toLowerCase();
    list=list.filter(e=>
      e.name.toLowerCase().includes(q)||
      (e.keys||'').toLowerCase().includes(q)||
      e.cat.toLowerCase().includes(q)
    );
  }
  return list;
}

function renderCatTabs(){
  catTabsEl.innerHTML=CATEGORIES.map(c=>
    `<div class="cat-tab${c===activeCat?' active':''}" data-cat="${c}">${c}</div>`
  ).join('');
  catTabsEl.querySelectorAll('.cat-tab').forEach(t=>{
    t.addEventListener('click',()=>{
      activeCat=t.dataset.cat;
      renderCatTabs();renderGrid();
    });
  });
}

function renderGrid(){
  const list=getVisibleEffects();
  const custom=loadCustomEffects().map(c=>c.id);
  const favs=loadFavs(LS_FAV_ANIM);
  if(!list.length){
    effectGrid.innerHTML=`<div class="no-result">${activeCat==='⭐收藏'?'还没有收藏任何动画，点左上角星标收藏':'没有找到匹配的效果'}</div>`;
    return;
  }
  effectGrid.innerHTML=list.map(e=>{
    const isCustom=custom.includes(e.id);
    const faved=favs.includes(e.id);
    return `<div class="effect-btn${e.id===selectedEffect?' selected':''}${isCustom?' custom-effect':''}" data-effect="${e.id}">
      <span class="fav-star${faved?' active':''}" data-fav="${e.id}">${faved?'★':'☆'}</span>
      ${isCustom?`<span class="del-btn" data-id="${e.id}">✕</span>`:''}
      <span class="ei">${e.emoji}</span>${e.name}
      <div class="cat-dot dot-${e.cat}"></div>
    </div>`;
  }).join('');
  effectGrid.querySelectorAll('.effect-btn').forEach(btn=>{
    btn.addEventListener('click',()=>selectEffect(btn.dataset.effect));
    const favBtn=btn.querySelector('.fav-star');
    if(favBtn){
      favBtn.addEventListener('click',ev=>{
        ev.stopPropagation();
        toggleFav(LS_FAV_ANIM,favBtn.dataset.fav);
        renderGrid();
      });
    }
    const delBtn=btn.querySelector('.del-btn');
    if(delBtn){
      delBtn.addEventListener('click',ev=>{
        ev.stopPropagation();
        const id=delBtn.dataset.id;
        const e=loadCustomEffects().find(x=>x.id===id);
        if(!confirm(`删除效果「${e?.name||id}」？`))return;
        const newList=loadCustomEffects().filter(x=>x.id!==id);
        saveCustomEffects(newList);
        delete runtimeEffects[id];
        if(selectedEffect===id)selectEffect('fade');
        else renderGrid();
      });
    }
  });
  animCountEl.textContent=BUILTIN_EFFECTS.length+loadCustomEffects().length;
}

function selectEffect(id){
  selectedEffect=id;
  previewStartT=null;
  const all=getAllEffects();
  const eff=all.find(e=>e.id===id);
  if(eff)selectedAnimName.textContent=eff.name;
  renderGrid();
  if(imageBitmap)startPreview();
}

searchInput.addEventListener('input',()=>{
  searchQuery=searchInput.value.trim();
  searchClear.style.display=searchQuery?'block':'none';
  renderGrid();
});
searchClear.addEventListener('click',()=>{
  searchInput.value='';searchQuery='';searchClear.style.display='none';renderGrid();
});

// ═══════════════════════════════════════════════════════════
//  特效 Grid
// ═══════════════════════════════════════════════════════════
let activeSfxCat='全部';
function renderSfxGrid(){
  let list=SPECIAL_EFFECTS;
  const favs=loadFavs(LS_FAV_SFX);
  if(activeSfxCat==='⭐收藏')list=list.filter(e=>favs.includes(e.id));
  if(sfxSearchQuery){
    const q=sfxSearchQuery.toLowerCase();
    list=list.filter(e=>e.name.toLowerCase().includes(q)||(e.desc||'').toLowerCase().includes(q));
  }
  const noneHtml=activeSfxCat==='全部'?`<div class="sfx-none-btn${selectedSfx===null?' selected':''}" data-sfx-none>
    <span class="ei">🚫</span>无特效
  </div>`:'';
  if(!list.length&&activeSfxCat==='⭐收藏'){
    sfxGrid.innerHTML='<div class="no-result">还没有收藏任何特效，点左上角星标收藏</div>';
  }else{
    sfxGrid.innerHTML=noneHtml+list.map(e=>{
      const faved=favs.includes(e.id);
      return `<div class="effect-btn${e.id===selectedSfx?' selected':''}" data-sfx="${e.id}" title="${e.desc||''}">
        <span class="fav-star${faved?' active':''}" data-sfx-fav="${e.id}">${faved?'★':'☆'}</span>
        <span class="ei">${e.emoji}</span>${e.name}
      </div>`;
    }).join('');
  }
  const noneBtn=sfxGrid.querySelector('[data-sfx-none]');
  if(noneBtn)noneBtn.addEventListener('click',()=>selectSfx(null));
  sfxGrid.querySelectorAll('[data-sfx]').forEach(btn=>{
    btn.addEventListener('click',()=>selectSfx(btn.dataset.sfx));
    const favBtn=btn.querySelector('.fav-star');
    if(favBtn){
      favBtn.addEventListener('click',ev=>{
        ev.stopPropagation();
        toggleFav(LS_FAV_SFX,favBtn.dataset.sfxFav);
        renderSfxGrid();
      });
    }
  });
  sfxCountEl.textContent=SPECIAL_EFFECTS.length;
}

document.getElementById('sfx-cat-tabs').addEventListener('click',e=>{
  const tab=e.target.closest('.cat-tab');
  if(!tab)return;
  document.querySelectorAll('#sfx-cat-tabs .cat-tab').forEach(t=>t.classList.remove('active'));
  tab.classList.add('active');
  activeSfxCat=tab.dataset.sfxCat;
  renderSfxGrid();
});

function selectSfx(id){
  selectedSfx=id;
  const e=SPECIAL_EFFECTS.find(x=>x.id===id);
  selectedSfxName.textContent=e?e.name:'无';
  previewStartT=null;
  renderSfxGrid();
  if(imageBitmap)startPreview();
}

sfxSearch.addEventListener('input',()=>{
  sfxSearchQuery=sfxSearch.value.trim();renderSfxGrid();
});

// ═══════════════════════════════════════════════════════════
//  绘帧 + 预览
// ═══════════════════════════════════════════════════════════
function drawFrame(ctx,bmp,canvasW,canvasH,transform,dw,dh,bgColor){
  dw=dw||canvasW;dh=dh||canvasH;
  const{x=0,y=0,scaleX=1,scaleY=1,rotation=0,alpha=1}=transform;
  // 背景色填充（纯色可大幅减少 GIF 边缘噪点）
  if(bgColor&&bgColor!=='transparent'){
    ctx.fillStyle=bgColor;
    ctx.fillRect(0,0,canvasW,canvasH);
  }else{
    ctx.clearRect(0,0,canvasW,canvasH);
  }
  ctx.save();
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.globalAlpha=max(0,min(1,alpha));
  ctx.translate(canvasW/2+x,canvasH/2+y);
  ctx.rotate(rotation*PI/180);
  ctx.scale(scaleX,scaleY);
  ctx.drawImage(bmp,-dw/2,-dh/2,dw,dh);
  ctx.restore();
}

function drawSfx(ctx,sfxId,t,w,h){
  if(!sfxId)return;
  const sfx=SPECIAL_EFFECTS.find(e=>e.id===sfxId);
  if(sfx){try{sfx.draw(ctx,t,w,h);}catch{}}
}

function getBgColor(){
  const v=bgSel.value;
  if(v==='white')return '#ffffff';
  if(v==='black')return '#000000';
  if(v==='gray')return '#f0f0f0';
  // 透明模式：返回 transparent；具体边缘色通过 getEdgeBlendRGB() 获取
  return 'transparent';
}
// 透明模式下半透明边缘混合的 RGB 值（避免色键扩散产生光晕）
function getEdgeBlendRGB(){
  const v=bgSel.value;
  if(v==='transparent-black')return [0,0,0];
  // 默认白边（包括 transparent-white 和旧的 transparent）
  return [255,255,255];
}

function getOutputDims(){
  const sizeVal=sizeSel.value;
  if(sizeVal==='auto'){
    const max_=400;let cw=imageBitmap.width,ch=imageBitmap.height;
    if(cw>max_||ch>max_){const r=min(max_/cw,max_/ch);cw=round(cw*r);ch=round(ch*r);}
    return{cw,ch,dw:cw,dh:ch};
  }
  const side=parseInt(sizeVal);
  const r=min(side/imageBitmap.width,side/imageBitmap.height);
  return{cw:side,ch:side,dw:round(imageBitmap.width*r),dh:round(imageBitmap.height*r)};
}

function startPreview(){
  if(!imageBitmap){previewEmpty.style.display='block';previewCvs.style.display='none';return;}
  previewEmpty.style.display='none';previewCvs.style.display='block';
  // 关键：预览 canvas 与最终 GIF 输出完全同尺寸，所见即所得
  const {cw:pw,ch:ph,dw:pdw,dh:pdh}=getOutputDims();
  previewCvs.width=pw;previewCvs.height=ph;
  // 通过 CSS 限制显示大小（最大 280px），像素 1:1 映射避免视觉失真
  previewCvs.style.maxWidth='280px';
  previewCvs.style.maxHeight='280px';
  previewCvs.style.imageRendering='auto';
  if(previewRAF)cancelAnimationFrame(previewRAF);
  previewStartT=null;
  function loop(ts){
    if(!previewStartT)previewStartT=ts;
    const t=((ts-previewStartT)%PREVIEW_DUR)/PREVIEW_DUR;
    const fn=runtimeEffects[selectedEffect]||runtimeEffects.fade;
    const bg=getBgColor();
    try{drawFrame(pCtx,imageBitmap,pw,ph,fn(t),pdw,pdh,bg);}catch{}
    drawSfx(pCtx,selectedSfx,t,pw,ph);
    // 预览完全模拟 GIF 输出：同阈值、同预乘、同二值化
    if(bg==='transparent'){
      try{
        const [ER,EG,EB]=getEdgeBlendRGB();
        const img=pCtx.getImageData(0,0,pw,ph);
        const d=img.data;
        const ALPHA_TH=96,A_REF=192;
        for(let p=0;p<d.length;p+=4){
          const a=d[p+3];
          if(a<ALPHA_TH){
            d[p+3]=0;
          }else{
            const ratio=min(a,A_REF)/A_REF;
            const ir=1-ratio;
            d[p]=round(d[p]*ratio+ER*ir);
            d[p+1]=round(d[p+1]*ratio+EG*ir);
            d[p+2]=round(d[p+2]*ratio+EB*ir);
            d[p+3]=255;
          }
        }
        pCtx.putImageData(img,0,0);
      }catch{}
    }
    previewRAF=requestAnimationFrame(loop);
  }
  previewRAF=requestAnimationFrame(loop);
}
sizeSel.addEventListener('change',()=>{if(imageBitmap)startPreview();});
bgSel.addEventListener('change',()=>{if(imageBitmap)startPreview();});

// ═══════════════════════════════════════════════════════════
//  上传
// ═══════════════════════════════════════════════════════════
async function loadFile(file){
  if(!file||!file.type.startsWith('image/'))return;
  const url=URL.createObjectURL(file);
  thumb.src=url;fileNameEl.textContent=file.name;
  fileSizeEl.textContent=(file.size/1024).toFixed(1)+' KB';
  dropZone.style.display='none';previewWrap.style.display='flex';
  imageBitmap=await createImageBitmap(file);
  startPreview();
}
fileInput.addEventListener('change',e=>loadFile(e.target.files[0]));
dropZone.addEventListener('dragover',e=>{e.preventDefault();dropZone.classList.add('drag-over');});
dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop',e=>{e.preventDefault();dropZone.classList.remove('drag-over');loadFile(e.dataTransfer.files[0]);});
document.addEventListener('paste',e=>{
  // 如果压缩弹窗打开，走压缩流程（只接收 GIF，去重防止重复）
  if(compressModal.classList.contains('show')){
    const seen=new Set();
    const gifs=[];
    // 优先使用 clipboardData.files（更稳定），否则回退到 items
    const fileList=e.clipboardData.files&&e.clipboardData.files.length
      ?Array.from(e.clipboardData.files)
      :Array.from(e.clipboardData.items||[]).map(it=>it.kind==='file'?it.getAsFile():null).filter(Boolean);
    for(const f of fileList){
      if(!f)continue;
      if(!/\.gif$/i.test(f.name)&&f.type!=='image/gif')continue;
      const key=(f.name||'unnamed')+'_'+f.size;
      if(seen.has(key))continue;
      seen.add(key);
      gifs.push(f);
    }
    if(gifs.length){addCompressFiles(gifs);e.preventDefault();}
    return;
  }
  // 主面板上传
  for(const item of e.clipboardData.items)
    if(item.type.startsWith('image/')){loadFile(item.getAsFile());break;}
});
btnReupload.addEventListener('click',()=>{
  dropZone.style.display='';previewWrap.style.display='none';
  if(previewRAF){cancelAnimationFrame(previewRAF);previewRAF=null;}
  fileInput.value='';imageBitmap=null;
  previewEmpty.style.display='block';previewCvs.style.display='none';
});

// ═══════════════════════════════════════════════════════════
//  API Key
// ═══════════════════════════════════════════════════════════
// (删除了 API key input 和 eye-btn 的绑定)

// ═══════════════════════════════════════════════════════════
//  AI 生成
// ═══════════════════════════════════════════════════════════
btnAiGen.addEventListener('click',async()=>{
  const desc=effectDesc.value.trim();
  if(!desc){aiStatus.textContent='请先描述你想要的效果';return;}
  const creds=window.App?.getCredentials?.();
  if(!creds){aiStatus.textContent='请先在左下角 🔑 API 设置 里填入 LLM Key';window.App?.openSettings?.();return;}
  btnAiGen.disabled=true;aiStatus.textContent='AI 生成中...';aiResult.style.display='none';
  try{
    const resp=await fetch('/api/gif-maker/ai-animation',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({description:desc,...creds})
    });
    const data=await resp.json();
    if(!resp.ok||data.error)throw new Error(data.error||`HTTP ${resp.status}`);
    const code=(data.code||'').trim();
    if(!code)throw new Error('AI 返回内容为空');
    const testFn=new Function('t',code);
    testFn(0);testFn(0.5);testFn(1);
    aiGeneratedCode=code;aiCode.textContent=code;
    aiResult.style.display='block';aiStatus.textContent='生成成功，已在预览区播放，满意请保存';
    runtimeEffects['__ai_preview']=testFn;
    selectEffect('__ai_preview');
  }catch(e){
    aiStatus.textContent='生成失败：'+e.message;
  }finally{btnAiGen.disabled=false;}
});

btnSave.addEventListener('click',()=>{
  const name=effectName.value.trim();
  if(!name){effectName.focus();return;}
  if(!aiGeneratedCode)return;
  const id='custom_'+Date.now();
  const item={id,name,code:aiGeneratedCode};
  const list=loadCustomEffects();list.push(item);saveCustomEffects(list);
  runtimeEffects[id]=new Function('t',aiGeneratedCode);
  delete runtimeEffects['__ai_preview'];
  activeCat='自定义';renderCatTabs();
  selectEffect(id);
  effectName.value='';aiResult.style.display='none';effectDesc.value='';
  aiStatus.textContent=`"${name}" 已保存，下次打开仍可使用`;
  aiGeneratedCode='';
});

// ═══════════════════════════════════════════════════════════
//  生成 GIF
// ═══════════════════════════════════════════════════════════
btnGenerate.addEventListener('click',async()=>{
  if(!imageBitmap){alert('请先上传一张图片！');return;}

  const duration=parseInt(durationSel.value,10);
  const loop=loopToggle.checked;
  const targetKB=parseInt(filesizeSel.value,10);
  const{cw,ch,dw,dh}=getOutputDims();
  const bgColor=getBgColor();
  const isTransparent=bgColor==='transparent';
  const edgeBlendRGB=getEdgeBlendRGB();
  const qualityLevel=qualitySel.value; // high / medium / low

  offscreen.width=cw;offscreen.height=ch;
  btnGenerate.disabled=true;progressWrap.style.display='block';
  resultWrap.style.display='none';progressBar.style.width='0%';
  progressText.textContent='初始化...';
  await new Promise(r=>setTimeout(r,30));

  const effectFn=runtimeEffects[selectedEffect]||runtimeEffects.fade;
  // 透明输出用 color key；否则背景色填充，无 key
  const TKEY=0x00B955,TKR=0,TKG=185,TKB=85;

  // 画质档位：quality 始终 1（最佳采样），只调 fps 来控制文件大小
  // 关键：dither 永远 false（Floyd-Steinberg 会基于像素值扩散误差，
  // 相邻帧像素略有差异就产生不同抖动模式，肉眼看就是噪点闪动）
  const qualityMap={
    high:{fpsLevels:targetKB>0?[15,12,10,8,6]:[15]},
    medium:{fpsLevels:targetKB>0?[15,12,10,8,6]:[12]},
    low:{fpsLevels:targetKB>0?[12,10,8,6,4]:[10]}
  };
  const {fpsLevels}=qualityMap[qualityLevel];
  let attempt=0,finalBlob=null;

  async function tryGenerate(fps){
    const totalFrames=duration*fps;
    const delay=round(1000/fps);
    const phaseLabel=fpsLevels.length>1?` (第${attempt+1}次尝试)`:'';

    const frames=[];
    for(let i=0;i<totalFrames;i++){
      const t=i/max(totalFrames-1,1);
      try{drawFrame(oCtx,imageBitmap,cw,ch,effectFn(t),dw,dh,bgColor);}
      catch{drawFrame(oCtx,imageBitmap,cw,ch,{},dw,dh,bgColor);}
      drawSfx(oCtx,selectedSfx,t,cw,ch);

      const raw=oCtx.getImageData(0,0,cw,ch);const d=raw.data;
      if(isTransparent){
        // 透明模式：二值化阈值 + 稳定预乘
        //  - α < 阈值：→ 色键绿（后续 GIF 标记为透明）
        //  - α ≥ 阈值：→ 预乘到固定 α，色值稳定（消除帧间边缘漂移）
        // 用固定 α_ref 而不是当前帧的 α，保证即使抗锯齿让某个像素
        // 在不同帧的 α 从 180 变到 200，它的输出 RGB 也完全一致
        const [ER,EG,EB]=edgeBlendRGB;
        const ALPHA_TH=96;  // 低于此阈值视为透明
        const A_REF=192;    // 固定参考 α：让保留像素统一预乘到这个强度
        for(let p=0;p<d.length;p+=4){
          const a=d[p+3];
          if(a<ALPHA_TH){
            d[p]=TKR;d[p+1]=TKG;d[p+2]=TKB;d[p+3]=255;
          }else{
            // 核心：用原像素 α 做预乘，但把结果再线性归一
            // 这样即使 α 从 128 变到 200，输出都是稳定预乘值
            const ratio=min(a,A_REF)/A_REF;
            const ir=1-ratio;
            d[p]=round(d[p]*ratio+ER*ir);
            d[p+1]=round(d[p+1]*ratio+EG*ir);
            d[p+2]=round(d[p+2]*ratio+EB*ir);
            if(d[p]===TKR&&d[p+1]===TKG&&d[p+2]===TKB)d[p+2]=TKB+1;
            d[p+3]=255;
          }
        }
      }else{
        // 不透明模式：直接清 alpha 到 255
        for(let p=3;p<d.length;p+=4)d[p]=255;
      }
      frames.push({data:new ImageData(new Uint8ClampedArray(d),cw,ch),delay});
      progressBar.style.width=round((i/totalFrames)*55)+'%';
      progressText.textContent=`生成帧 ${i+1} / ${totalFrames}${phaseLabel}`;
      if(i%5===0)await new Promise(r=>setTimeout(r,0));
    }

    return new Promise((resolve,reject)=>{
      // 核心：始终最佳画质参数
      //  quality=1：NeuQuant 扫描每个像素（最慢但最精准）
      //  globalPalette=true：首帧学调色板，后续帧共享 → 帧间零色彩漂移
      //  dither=false：禁用 Floyd-Steinberg，否则基于像素值的误差扩散会让相邻帧产生
      //               不同的抖动模式，造成视觉上的噪点闪动
      const gifOpts={
        workers:2,
        quality:1,
        workerScript:WORKER_URL,
        repeat:loop?0:-1,
        globalPalette:true,
        dither:false
      };
      if(isTransparent)gifOpts.transparent=TKEY;
      const gif=new GIF(gifOpts);
      const dispose=isTransparent?2:1;
      frames.forEach(f=>gif.addFrame(f.data,{delay:f.delay,copy:true,dispose}));
      progressText.textContent=`编码中${phaseLabel}...`;
      gif.on('progress',p=>{
        progressBar.style.width=(55+round(p*40))+'%';
        progressText.textContent=`编码中 ${round(p*100)}%${phaseLabel}`;
      });
      gif.on('finished',resolve);
      gif.on('error',reject);
      gif.render();
    });
  }

  try{
    for(let fi=0;fi<fpsLevels.length;fi++){
      attempt=fi;
      const fps=fpsLevels[fi];
      const blob=await tryGenerate(fps);
      const sizeKB=blob.size/1024;
      if(targetKB===0||sizeKB<=targetKB||fi===fpsLevels.length-1){
        finalBlob=blob;
        const url=URL.createObjectURL(blob);
        resultImg.src=url;btnDownload.href=url;
        btnDownload.download=`animation_${selectedEffect}${selectedSfx?'_'+selectedSfx:''}_${duration}s.gif`;

        const sizeTxt=sizeKB>=1024?(sizeKB/1024).toFixed(2)+' MB':sizeKB.toFixed(1)+' KB';
        const over=targetKB>0&&sizeKB>targetKB;
        resultMeta.innerHTML=`${cw}×${ch}px · ${fpsLevels[fi]} fps · 画质${qualityLevel==='high'?'高':qualityLevel==='medium'?'中':'低'} · <span style="color:${over?'#ef4444':'#22c55e'};font-weight:600">${sizeTxt}</span>${over?'<br><span style="color:#ef4444;font-size:11px">已尽力压缩</span>':''}`;

        progressBar.style.width='100%';
        progressText.textContent='完成！'+(fi>0?` 经过 ${fi+1} 次优化`:'');
        setTimeout(()=>{
          resultWrap.style.display='block';
          resultWrap.scrollIntoView({behavior:'smooth',block:'nearest'});
          btnGenerate.disabled=false;
          progressWrap.style.display='none';
        },400);
        break;
      }
    }
  }catch(err){
    console.error(err);
    progressText.textContent='生成失败，请重试';
    btnGenerate.disabled=false;
  }
});

// ═══════════════════════════════════════════════════════════
//  GIF 压缩弹窗（全面重构）
// ═══════════════════════════════════════════════════════════
const compressModal=$('compress-modal');
const compressDrop=$('compress-drop'),compressInput=$('compress-input');
const compressList=$('compress-list');
const btnCompressAll=$('btn-compress-all'),btnDownloadAll=$('btn-download-all');
const compressTarget=$('compress-target'),compressMaxsize=$('compress-maxsize');
const batchProgWrap=$('batch-progress-wrap'),batchProgLabel=$('batch-progress-label');
const batchProgBar=$('batch-progress-bar'),batchProgPct=$('batch-progress-pct');

// 对比预览弹窗
const previewModal=$('preview-modal');
const previewOrig=$('preview-orig'),previewComp=$('preview-comp');
const previewOrigSize=$('preview-orig-size'),previewCompSize=$('preview-comp-size');
const previewFilename=$('preview-filename'),previewStats=$('preview-stats');

let compressFiles=[]; // {id,file,name,originalSize,origUrl,compUrl,status,progress,progressText,blob,compressedSize,errorMsg}
let isBatchRunning=false;

// ── 弹窗开关 ──
$('btn-open-compress').addEventListener('click',()=>compressModal.classList.add('show'));
$('close-compress').addEventListener('click',()=>compressModal.classList.remove('show'));
compressModal.addEventListener('click',e=>{if(e.target===compressModal)compressModal.classList.remove('show');});

$('close-preview').addEventListener('click',()=>previewModal.classList.remove('show'));
previewModal.addEventListener('click',e=>{if(e.target===previewModal)previewModal.classList.remove('show');});

// ESC 关闭弹窗
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(previewModal.classList.contains('show')){previewModal.classList.remove('show');return;}
    if(compressModal.classList.contains('show'))compressModal.classList.remove('show');
  }
});

// ── 上传输入 ──
compressInput.addEventListener('change',e=>{addCompressFiles(e.target.files);compressInput.value='';});
compressDrop.addEventListener('dragover',e=>{e.preventDefault();compressDrop.classList.add('drag-over');});
compressDrop.addEventListener('dragleave',()=>compressDrop.classList.remove('drag-over'));
compressDrop.addEventListener('drop',e=>{e.preventDefault();compressDrop.classList.remove('drag-over');addCompressFiles(e.dataTransfer.files);});

function addCompressFiles(fileList){
  let added=0;
  for(const f of fileList){
    if(!/\.gif$/i.test(f.name)&&f.type!=='image/gif')continue;
    compressFiles.push({
      id:Date.now()+'_'+Math.random().toString(36).slice(2,7),
      file:f,name:f.name,originalSize:f.size,
      origUrl:URL.createObjectURL(f),compUrl:null,
      status:'pending',progress:0,progressText:'等待压缩',
      blob:null,compressedSize:0,errorMsg:''
    });
    added++;
  }
  if(added)renderCompressList();
}

function formatSize(b){return b>=1048576?(b/1048576).toFixed(2)+' MB':(b/1024).toFixed(1)+' KB';}

function renderCompressList(){
  if(!compressFiles.length){
    compressList.innerHTML='';
    btnCompressAll.disabled=true;btnDownloadAll.disabled=true;
    return;
  }
  const targetKB=parseInt(compressTarget.value);
  compressList.innerHTML=compressFiles.map(f=>{
    const over=f.compressedSize>0&&targetKB>0&&f.compressedSize>targetKB*1024;
    const savedPct=f.compressedSize>0?Math.round((1-f.compressedSize/f.originalSize)*100):0;
    return `<div class="compress-item ${f.status}" data-id="${f.id}">
      <img class="thumb" src="${f.origUrl}" alt="" />
      <div class="info">
        <div class="name">${f.name}</div>
        <div class="sizes">
          <span>${formatSize(f.originalSize)}</span>
          ${f.compressedSize?`<span class="arrow">→</span><span class="after${over?' over':''}">${formatSize(f.compressedSize)}</span><span class="saved">${savedPct>0?'↓'+savedPct+'%':''}</span>`:''}
        </div>
        <div class="progress-row">
          <div class="progress-bar"><div class="progress-fill" style="width:${f.progress}%"></div></div>
          <span class="progress-text">${f.progressText}</span>
        </div>
      </div>
      <div class="item-actions">
        <button class="action-btn preview-btn" title="对比预览" ${f.status==='done'?'':'disabled'}>👁</button>
        <button class="action-btn primary download-btn" title="下载" ${f.status==='done'?'':'disabled'}>⬇</button>
        <button class="action-btn danger del-file" title="移除">✕</button>
      </div>
    </div>`;
  }).join('');

  compressList.querySelectorAll('.preview-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const id=btn.closest('.compress-item').dataset.id;
      showComparePreview(id);
    });
  });
  compressList.querySelectorAll('.download-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const id=btn.closest('.compress-item').dataset.id;
      const f=compressFiles.find(x=>x.id===id);
      if(f?.blob)downloadBlob(f.blob,f.name.replace(/\.gif$/i,'_compressed.gif'));
    });
  });
  compressList.querySelectorAll('.del-file').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const id=btn.closest('.compress-item').dataset.id;
      const f=compressFiles.find(x=>x.id===id);
      if(f){
        if(f.origUrl)URL.revokeObjectURL(f.origUrl);
        if(f.compUrl)URL.revokeObjectURL(f.compUrl);
      }
      compressFiles=compressFiles.filter(x=>x.id!==id);
      renderCompressList();
    });
  });

  btnCompressAll.disabled=isBatchRunning||compressFiles.every(f=>f.status==='done');
  btnDownloadAll.disabled=!compressFiles.some(f=>f.status==='done');
}

function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},1000);
}

// ── 对比预览 ──
function showComparePreview(id){
  const f=compressFiles.find(x=>x.id===id);
  if(!f||!f.compUrl)return;
  previewFilename.textContent=f.name;
  previewOrig.src=f.origUrl;
  previewComp.src=f.compUrl;
  previewOrigSize.textContent=formatSize(f.originalSize);
  previewCompSize.textContent=formatSize(f.compressedSize);
  const savedPct=Math.round((1-f.compressedSize/f.originalSize)*100);
  const savedSize=formatSize(f.originalSize-f.compressedSize);
  previewStats.innerHTML=savedPct>0
    ?`压缩率 <strong>↓ ${savedPct}%</strong> · 节省 <strong>${savedSize}</strong> · 原图 ${formatSize(f.originalSize)} → 压缩后 ${formatSize(f.compressedSize)}`
    :`压缩后大小未减少（可能已是最优，或目标限制过宽松）`;
  previewModal.classList.add('show');
}

// ── 动态加载外部脚本（仅 JSZip，用于打包下载） ──
function loadScript(src){
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector(`script[src="${src}"]`);
    if(existing){
      if(existing.dataset.loaded==='1'){resolve();return;}
      existing.addEventListener('load',()=>resolve());
      existing.addEventListener('error',()=>reject(new Error('加载失败')));
      return;
    }
    const s=document.createElement('script');
    s.src=src;
    s.onload=()=>{s.dataset.loaded='1';resolve();};
    s.onerror=()=>reject(new Error('加载失败：'+src));
    document.head.appendChild(s);
  });
}
let jszipLoaded=false;
async function ensureJSZip(){
  if(jszipLoaded||window.JSZip)return;
  const urls=[
    'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
    'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js'
  ];
  let lastErr;
  for(const u of urls){
    try{await loadScript(u);jszipLoaded=true;return;}catch(e){lastErr=e;}
  }
  throw lastErr||new Error('JSZip 加载失败');
}

// ═══════════════════════════════════════════════════════════
//  内联 GIF 解码器（无外部依赖，完整实现 GIF89a 规范）
// ═══════════════════════════════════════════════════════════
class SimpleGifDecoder{
  constructor(buf){
    this.data=new Uint8Array(buf);
    this.pos=0;this.width=0;this.height=0;
    this.gct=null;this.frames=[];
    this._parse();
  }
  _u8(){return this.data[this.pos++];}
  _u16(){const v=this.data[this.pos]|(this.data[this.pos+1]<<8);this.pos+=2;return v;}
  _bytes(n){const r=this.data.subarray(this.pos,this.pos+n);this.pos+=n;return r;}
  _skipSub(){while(true){const s=this._u8();if(s===0)break;this.pos+=s;}}
  _readSub(){
    const chunks=[];let total=0;
    while(true){
      const s=this._u8();if(s===0)break;
      chunks.push(this.data.subarray(this.pos,this.pos+s));
      this.pos+=s;total+=s;
    }
    const r=new Uint8Array(total);let off=0;
    for(const c of chunks){r.set(c,off);off+=c.length;}
    return r;
  }
  _parse(){
    // Header
    const sig=String.fromCharCode(this._u8(),this._u8(),this._u8());
    this._u8();this._u8();this._u8(); // version
    if(sig!=='GIF')throw new Error('不是有效的 GIF 文件');
    // LSD
    this.width=this._u16();this.height=this._u16();
    const packed=this._u8();
    const hasGCT=!!(packed&0x80),gctSize=packed&0x07;
    this._u8();this._u8(); // bg+aspect
    if(hasGCT){
      const n=3*(1<<(gctSize+1));
      this.gct=this._bytes(n).slice();
    }
    // Blocks
    let gce=null;
    while(this.pos<this.data.length){
      const t=this._u8();
      if(t===0x3B)break;
      if(t===0x21){
        const label=this._u8();
        if(label===0xF9){
          this._u8(); // block size
          const pk=this._u8();
          const delay=this._u16()*10;
          const ti=this._u8();
          this._u8();
          gce={disposal:(pk>>2)&7,transparent:!!(pk&1),transparentIndex:ti,delay:delay||100};
        }else{this._skipSub();}
      }else if(t===0x2C){
        const left=this._u16(),top=this._u16(),fw=this._u16(),fh=this._u16();
        const pk=this._u8();
        const hasLCT=!!(pk&0x80),interlaced=!!(pk&0x40),lctSize=pk&0x07;
        let palette=this.gct;
        if(hasLCT){const n=3*(1<<(lctSize+1));palette=this._bytes(n).slice();}
        const minCodeSize=this._u8();
        const lzw=this._readSub();
        let indices=this._lzwDecode(lzw,minCodeSize,fw*fh);
        if(interlaced)indices=this._deinterlace(indices,fw,fh);
        this.frames.push({
          left,top,width:fw,height:fh,indices,palette,
          disposal:gce?.disposal||0,delay:gce?.delay||100,
          transparent:gce?.transparent||false,
          transparentIndex:gce?.transparentIndex||0
        });
        gce=null;
      }else if(t===0){continue;}else{break;}
    }
  }
  _lzwDecode(data,minCodeSize,pixelCount){
    const out=new Uint8Array(pixelCount);let outPos=0;
    const clearCode=1<<minCodeSize,endCode=clearCode+1;
    let codeSize=minCodeSize+1,nextCode=endCode+1;
    const prefix=new Int16Array(4096),suffix=new Uint8Array(4096),lens=new Uint16Array(4096);
    for(let i=0;i<clearCode;i++){prefix[i]=-1;suffix[i]=i;lens[i]=1;}
    let bitPos=0;const dataLen=data.length;
    const readCode=()=>{
      let c=0,bits=0;
      while(bits<codeSize){
        const bp=bitPos>>3;
        if(bp>=dataLen)return endCode;
        const bib=bitPos&7;
        const avail=Math.min(codeSize-bits,8-bib);
        const mask=(1<<avail)-1;
        c|=((data[bp]>>bib)&mask)<<bits;
        bits+=avail;bitPos+=avail;
      }
      return c;
    };
    const writeCode=(code)=>{
      const len=lens[code];
      const tmp=new Uint8Array(len);
      let cur=code;
      for(let i=len-1;i>=0;i--){tmp[i]=suffix[cur];cur=prefix[cur];}
      for(let i=0;i<len&&outPos<pixelCount;i++)out[outPos++]=tmp[i];
    };
    const firstOf=(code)=>{let c=code;while(prefix[c]!==-1)c=prefix[c];return suffix[c];};
    let prevCode=-1;
    while(outPos<pixelCount){
      const code=readCode();
      if(code===endCode)break;
      if(code===clearCode){
        codeSize=minCodeSize+1;nextCode=endCode+1;prevCode=-1;continue;
      }
      let fb;
      if(prevCode===-1){
        writeCode(code);fb=suffix[code];prevCode=code;continue;
      }
      if(code<nextCode){
        writeCode(code);fb=firstOf(code);
      }else{
        fb=firstOf(prevCode);
        writeCode(prevCode);
        if(outPos<pixelCount)out[outPos++]=fb;
      }
      if(nextCode<4096){
        prefix[nextCode]=prevCode;suffix[nextCode]=fb;lens[nextCode]=lens[prevCode]+1;
        nextCode++;
        if(nextCode===(1<<codeSize)&&codeSize<12)codeSize++;
      }
      prevCode=code;
    }
    return out;
  }
  _deinterlace(indices,w,h){
    const out=new Uint8Array(indices.length);let src=0;
    const passes=[[0,8],[4,8],[2,4],[1,2]];
    for(const[start,step] of passes){
      for(let y=start;y<h;y+=step){
        for(let x=0;x<w;x++)out[y*w+x]=indices[src*w+x];
        src++;
      }
    }
    return out;
  }
}

// ── 用内联解码器处理 GIF 为可绘制帧序列 ──
async function decodeGif(file,onProgress){
  const buf=await file.arrayBuffer();
  if(buf.byteLength<10)throw new Error('文件太小，不是有效 GIF');

  let dec;
  try{dec=new SimpleGifDecoder(buf);}
  catch(e){throw new Error('GIF 解析失败：'+e.message);}

  if(!dec.frames.length)throw new Error('GIF 没有帧数据');

  const w=dec.width,h=dec.height;
  if(w<=0||h<=0)throw new Error('GIF 尺寸异常');

  const fullCvs=document.createElement('canvas');
  fullCvs.width=w;fullCvs.height=h;
  const fullCtx=fullCvs.getContext('2d');
  const tempCvs=document.createElement('canvas');
  const tempCtx=tempCvs.getContext('2d');

  const result=[];
  let prevSnapshot=null;

  for(let i=0;i<dec.frames.length;i++){
    const f=dec.frames[i];

    // 保存当前状态以备 disposal=3 恢复
    if(i<dec.frames.length-1&&dec.frames[i].disposal===3){
      prevSnapshot=fullCtx.getImageData(0,0,w,h);
    }

    // 构建当前帧 RGBA
    if(!f.palette||f.palette.length<3){
      console.warn('[decode] frame palette missing, skip frame',i);
      continue;
    }
    const rgba=new Uint8ClampedArray(f.width*f.height*4);
    for(let j=0;j<f.indices.length;j++){
      const idx=f.indices[j];
      const p=idx*3;
      if(f.transparent&&idx===f.transparentIndex){
        rgba[j*4+3]=0;
      }else if(p+2<f.palette.length){
        rgba[j*4]=f.palette[p];
        rgba[j*4+1]=f.palette[p+1];
        rgba[j*4+2]=f.palette[p+2];
        rgba[j*4+3]=255;
      }
    }
    tempCvs.width=f.width;tempCvs.height=f.height;
    tempCtx.putImageData(new ImageData(rgba,f.width,f.height),0,0);

    // 合成到主画布（drawImage 保留透明通道）
    fullCtx.drawImage(tempCvs,f.left,f.top);

    const bitmap=await createImageBitmap(fullCvs);
    result.push({frame:bitmap,delay:f.delay});

    // 对当前帧执行 disposal
    if(f.disposal===2){
      fullCtx.clearRect(f.left,f.top,f.width,f.height);
    }else if(f.disposal===3&&prevSnapshot){
      fullCtx.putImageData(prevSnapshot,0,0);
      prevSnapshot=null;
    }

    if(onProgress)onProgress((i+1)/dec.frames.length);
  }

  if(!result.length)throw new Error('解码后无可用帧');
  return {frames:result,width:w,height:h};
}

function disposeFrames(frames){
  for(const f of frames){if(f.frame&&typeof f.frame.close==='function')f.frame.close();}
}

// ── 更新单文件进度 ──
function updateEntryProgress(entry,progress,text){
  entry.progress=progress;
  entry.progressText=text;
  const el=compressList.querySelector(`[data-id="${entry.id}"]`);
  if(el){
    const fill=el.querySelector('.progress-fill');
    const txt=el.querySelector('.progress-text');
    if(fill)fill.style.width=progress+'%';
    if(txt)txt.textContent=text;
  }
  updateBatchProgress();
}

function updateBatchProgress(){
  if(!isBatchRunning)return;
  const total=compressFiles.length;
  const done=compressFiles.filter(f=>f.status==='done'||f.status==='error').length;
  const current=compressFiles.find(f=>f.status==='processing');
  const fraction=(done+(current?current.progress/100:0))/total;
  const pct=Math.round(fraction*100);
  batchProgBar.style.width=pct+'%';
  batchProgPct.textContent=pct+'%';
  const curText=current?`正在压缩：${current.name}`:(done===total?'全部完成':'');
  batchProgLabel.querySelector('span:first-child').textContent=curText;
}

// ── 构建压缩策略阶梯 ──
// 核心原则：q=1 是画质红线，绝不越过
//  - dither 永远 false（避免帧间噪点）
//  - globalPal 永远 true（避免帧间色彩漂移）
//  - 需要减小文件时：只动 scale 和 frame skip，不动色彩质量
function buildCompressStrategies(targetKB){
  if(targetKB===0){
    return [{q:1,scaleMul:1,skip:1}];
  }
  return [
    // 最佳画质：原尺寸 + 全帧（q=1 红线不变）
    {q:1,scaleMul:1.00,skip:1},
    // 轻微缩小保画质（优先选项）
    {q:1,scaleMul:0.92,skip:1},
    {q:1,scaleMul:0.85,skip:1},
    {q:1,scaleMul:0.78,skip:1},
    {q:1,scaleMul:0.70,skip:1},
    {q:1,scaleMul:0.62,skip:1},
    {q:1,scaleMul:0.55,skip:1},
    // 需要更小时才开始丢帧（skip=2 保留 50% 帧）
    {q:1,scaleMul:0.70,skip:2},
    {q:1,scaleMul:0.55,skip:2},
    {q:1,scaleMul:0.45,skip:2},
    // 最后的妥协：每 3 帧取 1
    {q:1,scaleMul:0.50,skip:3},
    {q:1,scaleMul:0.40,skip:3},
    // 真的还不行才降 NeuQuant 采样精度
    {q:3,scaleMul:0.40,skip:3}
  ];
}

// ── 检测帧是否包含透明像素 ──
function hasTransparency(frames){
  const f=frames[0];
  if(!f||!f.frame)return false;
  const cvs=document.createElement('canvas');
  cvs.width=Math.min(64,f.frame.width);cvs.height=Math.min(64,f.frame.height);
  const ctx=cvs.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(f.frame,0,0,cvs.width,cvs.height);
  const d=ctx.getImageData(0,0,cvs.width,cvs.height).data;
  for(let i=3;i<d.length;i+=4)if(d[i]<250)return true;
  return false;
}

// ── 压缩一个文件 ──
async function compressOne(entry){
  entry.status='processing';
  updateEntryProgress(entry,0,'解码中...');
  renderCompressList();

  if(entry.file.size>80*1024*1024){
    entry.status='error';
    entry.errorMsg='文件过大（>80MB）';
    updateEntryProgress(entry,100,'失败：文件过大（>80MB）');
    renderCompressList();
    return;
  }

  let decodedFrames=null;
  try{
    // 阶段一：解码（0-25%）
    updateEntryProgress(entry,3,'解析 GIF...');
    const {frames,width:ow,height:oh}=await decodeGif(entry.file,p=>{
      updateEntryProgress(entry,3+Math.round(p*22),`解码 ${Math.round(p*100)}%`);
    });
    decodedFrames=frames;
    if(!frames.length)throw new Error('没有可用帧');

    // 检测透明度（决定是否用白底）
    const isTransparent=hasTransparency(frames);

    // 阶段二：准备参数
    const maxSize=parseInt(compressMaxsize.value);
    const targetKB=parseInt(compressTarget.value);

    // ★ Fast-path：如果原图已满足所有要求，直接 pass-through，避免重编码导致的质量损失
    const sizeOK=targetKB===0||entry.originalSize<=targetKB*1024;
    const dimOK=maxSize===0||(ow<=maxSize&&oh<=maxSize);
    if(sizeOK&&dimOK){
      entry.blob=entry.file;
      entry.compressedSize=entry.originalSize;
      entry.compUrl=entry.origUrl;  // 复用上传时的 URL
      entry.status='done';
      updateEntryProgress(entry,100,'原图已达标（直接保留）✓');
      renderCompressList();
      return;
    }

    // 用户设的最大尺寸缩放
    let baseScale=1;
    if(maxSize>0&&(ow>maxSize||oh>maxSize))baseScale=Math.min(maxSize/ow,maxSize/oh);

    // 阶段三：按策略阶梯尝试
    const strategies=buildCompressStrategies(targetKB);
    const outCvs=document.createElement('canvas');
    const outCtx=outCvs.getContext('2d');

    let finalBlob=null,usedStrategy=null;
    for(let attempt=0;attempt<strategies.length;attempt++){
      const st=strategies[attempt];
      const effectiveScale=baseScale*st.scaleMul;
      const nw=Math.max(16,Math.round(ow*effectiveScale));
      const nh=Math.max(16,Math.round(oh*effectiveScale));

      const selected=frames.filter((_,i)=>i%st.skip===0);
      // 保流畅度：帧数少于 3 时不再丢帧
      if(selected.length<3&&st.skip>1)continue;

      const label=st.skip>1?`丢帧 ${st.skip}x · 尺寸 ${Math.round(st.scaleMul*100)}%`:`尺寸 ${Math.round(st.scaleMul*100)}%`;
      updateEntryProgress(entry,25,`编码：${label}...`);

      outCvs.width=nw;outCvs.height=nh;
      outCtx.imageSmoothingEnabled=true;
      outCtx.imageSmoothingQuality='high';

      // 核心：与生成端一致的高画质参数
      const gifOpts={
        workers:2,
        quality:st.q,       // 红线 1
        workerScript:WORKER_URL,
        width:nw,height:nh,
        repeat:0,
        globalPalette:true, // 始终全局调色板 → 帧间色彩稳定
        dither:false        // 始终关闭抖动 → 无帧间噪点
      };
      if(isTransparent)gifOpts.transparent=0x00B955;
      const gif=new GIF(gifOpts);

      for(const f of selected){
        outCtx.clearRect(0,0,nw,nh);
        if(!isTransparent){
          // 不透明：白底避免边缘噪点
          outCtx.fillStyle='#ffffff';
          outCtx.fillRect(0,0,nw,nh);
        }
        outCtx.drawImage(f.frame,0,0,nw,nh);

        if(isTransparent){
          // 透明模式：智能边缘处理（避免色键扩散产生绿色光晕）
          // 完全透明 → 色键；半透明边缘 → 预乘白色；不透明 → 原色
          const imgData=outCtx.getImageData(0,0,nw,nh);
          const d=imgData.data;
          for(let p=0;p<d.length;p+=4){
            const a=d[p+3];
            if(a<8){
              d[p]=0;d[p+1]=185;d[p+2]=85;d[p+3]=255;
            }else{
              if(a<255){
                const r=a/255,ir=1-r;
                d[p]=Math.round(d[p]*r+255*ir);
                d[p+1]=Math.round(d[p+1]*r+255*ir);
                d[p+2]=Math.round(d[p+2]*r+255*ir);
              }
              if(d[p]===0&&d[p+1]===185&&d[p+2]===85)d[p+2]=86;
              d[p+3]=255;
            }
          }
          outCtx.putImageData(imgData,0,0);
        }
        gif.addFrame(outCtx,{copy:true,delay:f.delay*st.skip});
      }

      const blob=await new Promise((resolve,reject)=>{
        gif.on('progress',p=>{
          const pct=25+Math.round(p*70);
          updateEntryProgress(entry,pct,`编码 ${label} ${Math.round(p*100)}%`);
        });
        gif.on('finished',resolve);
        gif.on('abort',()=>reject(new Error('编码中断')));
        gif.on('error',reject);
        gif.render();
      });

      // 大小达标 or 已经是最后一档 or 比原文件还小 50% 即可停
      const sizeOK=targetKB===0||blob.size<=targetKB*1024;
      const smallerThanOrig=blob.size<entry.originalSize*0.95;
      if(sizeOK||attempt===strategies.length-1||(attempt>=5&&smallerThanOrig)){
        finalBlob=blob;usedStrategy=st;
        break;
      }
    }

    if(!finalBlob)throw new Error('压缩失败');

    entry.blob=finalBlob;
    entry.compressedSize=finalBlob.size;
    entry.compUrl=URL.createObjectURL(finalBlob);
    entry.status='done';
    updateEntryProgress(entry,100,'完成 ✓');
  }catch(err){
    console.error('[compress]',err);
    entry.status='error';
    entry.errorMsg=err.message||'未知错误';
    updateEntryProgress(entry,100,'失败：'+entry.errorMsg);
  }finally{
    if(decodedFrames)disposeFrames(decodedFrames);
  }
  renderCompressList();
}

// ── 批量压缩 ──
btnCompressAll.addEventListener('click',async()=>{
  const pending=compressFiles.filter(f=>f.status!=='done');
  if(!pending.length)return;

  isBatchRunning=true;
  btnCompressAll.disabled=true;
  batchProgWrap.style.display='block';
  batchProgBar.style.width='0%';
  batchProgPct.textContent='0%';
  batchProgLabel.querySelector('span:first-child').textContent='准备中...';

  for(let i=0;i<pending.length;i++){
    await compressOne(pending[i]);
  }

  isBatchRunning=false;
  updateBatchProgress();
  const success=compressFiles.filter(f=>f.status==='done').length;
  const fail=compressFiles.filter(f=>f.status==='error').length;
  batchProgLabel.querySelector('span:first-child').textContent=`全部完成 · 成功 ${success}${fail>0?' · 失败 '+fail:''}`;
  batchProgBar.style.width='100%';
  batchProgPct.textContent='100%';
  setTimeout(()=>{batchProgWrap.style.display='none';},3500);
  renderCompressList();
});

// ── 打包下载 ──
btnDownloadAll.addEventListener('click',async()=>{
  const done=compressFiles.filter(f=>f.status==='done'&&f.blob);
  if(!done.length)return;
  if(done.length===1){
    downloadBlob(done[0].blob,done[0].name.replace(/\.gif$/i,'_compressed.gif'));
    return;
  }
  btnDownloadAll.disabled=true;
  btnDownloadAll.textContent='加载打包库...';
  try{
    await ensureJSZip();
    btnDownloadAll.textContent='打包中...';
    const zip=new JSZip();
    done.forEach(f=>{
      zip.file(f.name.replace(/\.gif$/i,'_compressed.gif'),f.blob);
    });
    const content=await zip.generateAsync({type:'blob'},meta=>{
      btnDownloadAll.textContent=`打包中 ${Math.round(meta.percent)}%`;
    });
    downloadBlob(content,'compressed_gifs_'+Date.now()+'.zip');
  }catch(err){
    alert('打包失败：'+err.message);
  }finally{
    btnDownloadAll.disabled=false;
    btnDownloadAll.textContent='📦 打包下载全部';
  }
});

compressTarget.addEventListener('change',renderCompressList);

// ═══════════════════════════════════════════════════════════
//  初始化
// ═══════════════════════════════════════════════════════════
loadCustomEffects().forEach(item=>{
  try{runtimeEffects[item.id]=new Function('t',item.code);}catch{}
});
renderCatTabs();
renderGrid();
renderSfxGrid();

  }
  if (window.__gifmk_lib_loaded && typeof window.GIF === 'function') {
    go();
  } else {
    window.addEventListener('gifmk:libLoaded', go, { once: true });
  }
}

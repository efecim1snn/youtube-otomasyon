// Yanlis gorselleri degistirir. Pexels "honey badger" icin bronz heykel,
// "polar bear" icin muze maketi donduruyordu. Aday metnini eleyerek seciyoruz.
"use strict";
const https=require("https"),fs=require("fs"),path=require("path");
const KOK=__dirname;
function env(a){try{for(const l of fs.readFileSync(path.join(KOK,".env"),"utf8").split(/\r?\n/)){
 const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m&&m[1]===a)return m[2].trim();}}catch(e){}return"";}
const PEX=env("PEXELS_KEY"),PIX=env("PIXABAY_KEY");
const get=(u,h)=>new Promise((ok,no)=>{https.get(u,{headers:h||{}},r=>{
 if(r.statusCode>=300&&r.statusCode<400&&r.headers.location)return get(r.headers.location,h).then(ok,no);
 if(r.statusCode!==200)return no(new Error("HTTP "+r.statusCode));
 const c=[];r.on("data",d=>c.push(d));r.on("end",()=>ok(Buffer.concat(c)));}).on("error",no);});

const YASAK=/statue|sculpture|bronze|figurine|toy|plush|stuffed|taxiderm|museum|drawing|painting|illustration|art|tattoo|logo|cartoon|costume|mask|skull|bone|fossil|chick|baby|cub|juvenile|nest|dog|husky|puppy|pet/i;

async function ara(sorgu){
  let a=[];
  try{const d=JSON.parse((await get("https://api.pexels.com/v1/search?query="+encodeURIComponent(sorgu)+
    "&per_page=40&orientation=portrait",{Authorization:PEX})).toString());
   a=(d.photos||[]).map(p=>({u:p.src.large2x||p.src.original,w:p.width,h:p.height,k:"pexels",alt:p.alt||""}));}catch(e){}
  try{const d=JSON.parse((await get("https://pixabay.com/api/?key="+PIX+"&q="+encodeURIComponent(sorgu)+
    "&image_type=photo&per_page=40&orientation=vertical")).toString());
   a=a.concat((d.hits||[]).map(p=>({u:p.largeImageURL,w:p.imageWidth,h:p.imageHeight,k:"pixabay",alt:p.tags||""})));}catch(e){}
  return a;
}
function sec(adaylar,zorunlu){
  const puan=x=>{
    const t=(x.alt||"").toLowerCase();
    if(YASAK.test(t)) return -100;
    let p=0;
    for(const z of zorunlu) if(t.includes(z)) p+=10;
    if(x.h>=x.w*1.2) p+=4; else if(x.h>=x.w) p+=2;
    if(x.w>=2000) p+=1;
    return p;
  };
  return adaylar.map(x=>({x,p:puan(x)})).filter(o=>o.p>0).sort((a,b)=>b.p-a.p).map(o=>o.x);
}
const ISLER=[
 {is:"106-harpi-vs-kartal", dosya:"ust.jpg", sorgular:["harpy eagle adult","harpy eagle bird","eagle predator perched"], zorunlu:["harpy","eagle"]},
 {is:"107-komodo-vs-bal-porsugu", dosya:"alt.jpg", sorgular:["honey badger animal","ratel honey badger","badger wildlife"], zorunlu:["badger"]},
 {is:"109-kutup-ayisi-vs-kaplan", dosya:"ust.jpg", sorgular:["polar bear arctic snow","polar bear wild","polar bear swimming"], zorunlu:["polar","bear"]},
 {is:"110-sirtlan-vs-kurt", dosya:"alt.jpg", sorgular:["gray wolf wild","wolf howling forest","grey wolf wildlife"], zorunlu:["wolf"]},
 {is:"108-jaguar-vs-anakonda", dosya:"alt.jpg", sorgular:["green anaconda snake","anaconda water snake","large constrictor snake"], zorunlu:["anaconda","snake"]},
];
(async()=>{
 for(const w of ISLER){
  let bulundu=null;
  for(const s of w.sorgular){
   const iyi=sec(await ara(s),w.zorunlu);
   if(iyi.length){bulundu={...iyi[0],sorgu:s};break;}
   console.log("   ("+s+" -> uygun aday yok)");
  }
  if(!bulundu){console.log("!! "+w.is+" — hicbir aday elemeden gecmedi");continue;}
  const b=await get(bulundu.u);
  const hedef=path.join(KOK,"uretim",w.is,"Images",w.dosya);
  fs.writeFileSync(hedef,b);
  console.log(`${w.is}/${w.dosya}  "${bulundu.sorgu}"  ${bulundu.w}x${bulundu.h} ${bulundu.k}`);
  console.log(`   -> ${bulundu.alt.slice(0,80)}`);
 }
})();

#!/usr/bin/env node
/* Test de regresión del motor — protege lo construido sin versionar datos de cliente.
   Dos capas:
     1) INVARIANTES (siempre): garantías estructurales que NO dependen del corpus
        concreto (no guardan nada del cliente). Si fallan -> exit 1.
     2) SNAPSHOT (opcional): recuentos por archivo, anonimizados por hash de nombre,
        guardados en .regresion-baseline.json (gitignored). Avisa de bajadas para
        revisión humana (una bajada puede ser corrección, no siempre es un bug).

   Uso:
     node test-regresion.js <carpeta_corpus>            # invariantes + compara snapshot
     node test-regresion.js <carpeta_corpus> --save     # guarda/actualiza el snapshot
   No instala nada: usa el SheetJS embebido en el HTML y el motor compartido. */
"use strict";
var fs=require("fs"), path=require("path"), crypto=require("crypto");

function cargarXLSX(){
  try { return require("xlsx-js-style"); } catch(e){}
  try { return require("xlsx"); } catch(e){}
  var html=fs.readFileSync(path.join(__dirname,"hopper_multicapa.html"),"utf8");
  var i=html.indexOf("xlsx-js-style.min.js"), s=html.indexOf("*/",i)+2, e=html.indexOf("</script>",s);
  var mod={exports:{}}; new Function("module","exports","require","window", html.slice(s,e))(mod,mod.exports,undefined,globalThis);
  return mod.exports;
}
var XLSX=cargarXLSX(), core=require(path.join(__dirname,"normalizar.core.js"));

var dir=process.argv[2], save=process.argv.indexOf("--save")>=0;
if(!dir){ console.error("Uso: node test-regresion.js <carpeta_corpus> [--save]"); process.exit(1); }
var BASE=path.join(__dirname,".regresion-baseline.json");
function hash(s){ return crypto.createHash("sha1").update(s).digest("hex").slice(0,12); }

var files=fs.readdirSync(dir).filter(function(f){return /\.(xlsx|xlsm|xls)$/i.test(f);}).sort();
if(!files.length){ console.error("No hay Excel en "+dir); process.exit(1); }

var fallos=[], snapshot={}, items=[];
var errLectura=0, silentLoss=[], capVacioConRuta=0, totMed=0;

files.forEach(function(f){
  var det;
  try { det=core.normalizar(XLSX.read(fs.readFileSync(path.join(dir,f))), f, XLSX, {}); }
  catch(e){ errLectura++; fallos.push("lectura: "+f+" -> "+e.message); return; }
  items.push({archivo:f, det:det});
  var usadas=0, limpias=0, med=det.mediciones.length;
  Object.keys(det.info).forEach(function(h){
    var inf=det.info[h];
    // INVARIANTE: ninguna hoja con señal clara de medición (estMedidas>=8) puede
    // quedarse en 0 partidas SIN avisar (eso sería pérdida silenciosa).
    if(!inf.excluida && (inf.estMedidas||0)>=8 && (inf.nMed||0)===0 && !(inf.avisos&&inf.avisos.length))
      silentLoss.push(f+" › "+h+" (est "+inf.estMedidas+", 0 partidas, sin aviso)");
    if(!inf.excluida){ usadas++; if(!(inf.avisos&&inf.avisos.length)) limpias++; }
  });
  totMed+=med;
  snapshot[hash(f)]={med:med, hojasUsadas:usadas, hojasLimpias:limpias, esMQT:det.esMQT!==false};
});

// INVARIANTE: capítulo nunca vacío teniendo ruta (regla universal del proyecto).
var acc=core.acumular(items);
acc.mediciones.forEach(function(r){ if(!String(r.capitulo||"").trim() && String(r.ruta||"").trim()) capVacioConRuta++; });

// INVARIANTE: el motor embebido en el HTML == el standalone.
var emb=(function(){
  try{ var html=fs.readFileSync(path.join(__dirname,"hopper_multicapa.html"),"utf8");
    var sm="/* Motor de normalización", em="})(typeof window!==\"undefined\"?window:this);";
    var s=html.indexOf(sm), e=html.indexOf(em)+em.length;
    var std=fs.readFileSync(path.join(__dirname,"normalizar.core.js"),"utf8").replace(/\s*$/,"");
    return html.slice(s,e)===std; }catch(e){ return false; }
})();

if(errLectura) fallos.push(errLectura+" fichero(s) con error de lectura");
if(silentLoss.length) fallos.push("pérdida silenciosa en "+silentLoss.length+" hoja(s):\n    - "+silentLoss.join("\n    - "));
if(capVacioConRuta) fallos.push(capVacioConRuta+" partida(s) con capítulo vacío TENIENDO ruta (invariante roto)");
if(!emb) fallos.push("el motor embebido en hopper_multicapa.html NO coincide con normalizar.core.js");

console.log("\n════════ TEST DE REGRESIÓN ════════");
console.log("Ficheros: "+files.length+" · mediciones: "+totMed+" · core embebido == standalone: "+(emb?"sí":"NO"));

// ---- snapshot ----
if(save){
  fs.writeFileSync(BASE, JSON.stringify({fecha:new Date().toISOString(), total:totMed, files:snapshot}, null, 0));
  console.log("Snapshot guardado ("+Object.keys(snapshot).length+" ficheros) en "+path.basename(BASE));
} else if(fs.existsSync(BASE)){
  var base=JSON.parse(fs.readFileSync(BASE,"utf8")), bf=base.files||{}, bajadas=[], subidas=0, nuevos=0, faltan=0;
  Object.keys(snapshot).forEach(function(k){
    if(!bf[k]){ nuevos++; return; }
    if(snapshot[k].med < bf[k].med) bajadas.push("  ↓ "+bf[k].med+" -> "+snapshot[k].med+" mediciones (hash "+k+")");
    else if(snapshot[k].med > bf[k].med) subidas++;
    if(bf[k].esMQT && !snapshot[k].esMQT) bajadas.push("  ⚠ un archivo dejó de detectarse como MQT (hash "+k+")");
  });
  Object.keys(bf).forEach(function(k){ if(!snapshot[k]) faltan++; });
  console.log("Snapshot: "+bajadas.length+" bajada(s) · "+subidas+" subida(s) · "+nuevos+" nuevo(s) · "+faltan+" ausente(s)");
  if(bajadas.length){ console.log("\n⚠ BAJADAS (revisa si son correcciones o regresiones):\n"+bajadas.join("\n")); }
} else {
  console.log("(sin snapshot previo; ejecuta con --save para crear la línea base)");
}

// ---- veredicto de invariantes ----
if(fallos.length){
  console.log("\n✗ INVARIANTES ROTOS:");
  fallos.forEach(function(x){ console.log("  ✗ "+x); });
  process.exit(1);
}
console.log("\n✓ Invariantes OK (0 errores de lectura · 0 pérdidas silenciosas · capítulo/ruta coherente · embebido sincronizado).");

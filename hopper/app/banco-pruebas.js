#!/usr/bin/env node
/* Banco de pruebas headless — "entrenar con muchos ficheros" sin UI.
   Recorre una carpeta de MQT, normaliza cada uno con el MISMO motor que el HTML
   (normalizar.core.js) y reporta: mediciones, hojas usadas y hojas con avisos.
   Así se mide el auto-éxito y se cazan los casos que aún fallan.

   Uso:  node banco-pruebas.js <carpeta_con_excels>
   No necesita instalar nada: extrae el SheetJS embebido del propio HTML. */
"use strict";
var fs=require("fs"), path=require("path");

// --- cargar SheetJS embebido en hopper_normalizador.html (una sola copia de la lib) ---
function cargarXLSX(){
  try { return require("xlsx"); } catch(e){}
  var html=fs.readFileSync(path.join(__dirname,"hopper_normalizador.html"),"utf8");
  var i=html.indexOf("xlsx.full.min.js");
  var start=html.indexOf("*/", i)+2;
  var end=html.indexOf("</script>", start);
  var src=html.slice(start, end);
  var mod={exports:{}};
  new Function("module","exports", src)(mod, mod.exports);
  return mod.exports;
}
var XLSX=cargarXLSX();
var core=require("./normalizar.core.js");

var dir=process.argv[2];
if(!dir){ console.error("Uso: node banco-pruebas.js <carpeta_con_excels>"); process.exit(1); }
var files=fs.readdirSync(dir).filter(function(f){ return /\.(xlsx|xlsm|xls)$/i.test(f); }).sort();
if(!files.length){ console.error("No hay .xlsx/.xlsm/.xls en "+dir); process.exit(1); }

var totUsadas=0, totLimpias=0, totMed=0, errores=0;
files.forEach(function(f){
  var wb, det;
  try { wb=XLSX.read(fs.readFileSync(path.join(dir,f)),{type:"buffer"}); det=core.normalizar(wb, f, XLSX, {}); }
  catch(e){ errores++; console.log("\n=== "+f+" ===\n  ✗ ERROR al leer/procesar: "+e.message); return; }
  var hojas=Object.keys(det.info);
  var usadas=hojas.filter(function(h){return !det.info[h].excluida;});
  var conAviso=usadas.filter(function(h){return (det.info[h].avisos||[]).length;});
  totUsadas+=usadas.length; totLimpias+=(usadas.length-conAviso.length); totMed+=det.mediciones.length;
  console.log("\n=== "+f+" ===");
  console.log("  mediciones: "+det.mediciones.length+" · notas: "+det.notas.length+
              " · hojas usadas: "+usadas.length+"/"+hojas.length+" · limpias: "+(usadas.length-conAviso.length));
  conAviso.forEach(function(h){ console.log("  ⚠ "+h+": "+det.info[h].avisos.join(" | ")); });
});
console.log("\n──────── RESUMEN ────────");
console.log("Ficheros: "+files.length+" ("+errores+" con error) · mediciones totales: "+totMed);
console.log("Hojas usadas: "+totUsadas+" · limpias (sin avisos): "+totLimpias+
            " · auto-éxito: "+(totUsadas?Math.round(100*totLimpias/totUsadas):0)+"%");

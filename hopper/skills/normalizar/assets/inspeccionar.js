#!/usr/bin/env node
/* Inspector para diagnosticar casos difíciles: vuelca las hojas, las columnas
   que detecta el motor y las primeras filas CRUDAS de una hoja, para ver el
   patrón del código y los títulos. Usa el mismo motor y SheetJS que la app.

   Uso:  node inspeccionar.js <archivo.xlsx> [nombre_hoja] [n_filas]      */
"use strict";
var fs=require("fs"), path=require("path");
var APP=path.join(__dirname, "..", "..", "..", "app");
function cargarXLSX(){
  try { return require("xlsx-js-style"); } catch(e){}
  try { return require("xlsx"); } catch(e){}
  var html=fs.readFileSync(path.join(APP,"hopper_multicapa.html"),"utf8");
  var i=html.indexOf("xlsx-js-style.min.js"), s=html.indexOf("*/",i)+2, e=html.indexOf("</script>",s);
  var mod={exports:{}}; new Function("module","exports","require","window", html.slice(s,e))(mod,mod.exports,undefined,globalThis);
  return mod.exports;
}
var XLSX=cargarXLSX(), core=require(path.join(APP,"normalizar.core.js"));
var file=process.argv[2], hoja=process.argv[3], n=parseInt(process.argv[4]||"30",10);
if(!file){ console.error("Uso: node inspeccionar.js <archivo.xlsx> [hoja] [n_filas]"); process.exit(1); }
var wb=XLSX.read(fs.readFileSync(file));
console.log("HOJAS:", wb.SheetNames.join("  |  "));
if(!hoja){ console.log("\n(pasa el nombre de una hoja para ver su contenido)"); process.exit(0); }
var ws=wb.Sheets[hoja]; if(!ws){ console.error("No existe la hoja «"+hoja+"»"); process.exit(1); }
var rng=XLSX.utils.decode_range(ws["!ref"]);
var grid=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null,blankrows:true,range:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rng.e.r,c:rng.e.c}})});
var d=core.autoDetect(grid);
console.log("\nfilas:", grid.length, "· familia:", d.familia, "· headerRow:", d.headerRow);
console.log("columnas detectadas:", JSON.stringify(d.cols));
console.log("\nprimeras "+n+" filas (col 0-6, recortadas):");
grid.slice(0,n).forEach(function(r,i){ r=r||[];
  console.log(String(i+1).padStart(4)+" | "+r.slice(0,7).map(function(c){return JSON.stringify(c===null?"":c).slice(0,22);}).join(" | "));
});

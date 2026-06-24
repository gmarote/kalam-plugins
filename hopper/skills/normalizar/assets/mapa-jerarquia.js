#!/usr/bin/env node
/* Mapa de jerarquía desde la hoja RESUMO/ÍNDICE — herramienta del flujo interactivo.
   Una hoja Resumo/Índice se descarta como FUENTE DE MEDICIONES, pero suele ser el
   MAPA MAESTRO de la jerarquía: lista código -> título de cada capítulo/subcapítulo
   (p. ej. «1. ARQUITECTURA», «1.3 ALVENARIAS»). Este asset extrae ese diccionario y,
   opcionalmente, lo APLICA a las hojas de medición para componer la jerarquía perfecta.

   NO toca el motor: resuelve ESE fichero (modelo del plugin). El nivel sale del nº de
   segmentos del código (1 -> capítulo, 2 -> subcapítulo, 3 -> sección, 4+ -> solo ruta).

   Uso:
     node mapa-jerarquia.js <archivo.xlsx>                 # vuelca el mapa + cobertura
     node mapa-jerarquia.js <archivo.xlsx> --out <carpeta> # además escribe los 2 Excel
   No instala nada: usa el SheetJS embebido en el HTML de la app y el motor compartido. */
"use strict";
var fs=require("fs"), path=require("path");
var APP=path.join(__dirname, "..", "..", "..", "app");
function cargarXLSX(){
  try { return require("xlsx-js-style"); } catch(e){}
  try { return require("xlsx"); } catch(e){}
  var html=fs.readFileSync(path.join(APP,"hopper_multicapa.html"),"utf8");
  var i=html.indexOf("xlsx-js-style.min.js"), s=html.indexOf("*/",i)+2, e=html.indexOf("</script>",s);
  var mod={exports:{}};
  new Function("module","exports","require","window", html.slice(s,e))(mod,mod.exports,undefined,globalThis);
  return mod.exports;
}
var XLSX=cargarXLSX();
var core=require(path.join(APP,"normalizar.core.js"));

function txt(v){ return v==null?"":String(v).trim(); }
function normCod(s){ return txt(s).replace(/\s+/g,"").replace(/\.+$/,"").replace(/\.{2,}/g,"."); }
function gridDe(ws){ if(!ws||!ws["!ref"]) return []; var r=XLSX.utils.decode_range(ws["!ref"]);
  return XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null,blankrows:true,range:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:r.e.r,c:r.e.c}})}); }
var esResumo=function(s){ return /^\s*(res|resumo|resumen|[íi]ndice|index)\b/i.test(String(s||"")); };
var esCodigo=function(s){ s=normCod(s); return /^[A-Za-z]{0,4}\d+(\.[A-Za-z0-9]+)*$/.test(s) && /\d/.test(s); };

// --- construye el diccionario código->{título,nivel} desde la hoja Resumo/Índice ---
function mapaDe(wb){
  var rn=wb.SheetNames.find(esResumo); if(!rn) return null;
  var g=gridDe(wb.Sheets[rn]); if(!g.length) return null;
  var d=core.autoDetect(g), cc=d.cols.code, cd=d.cols.desc;
  if(cc==null||cd==null) return null;
  var map={}, n=0;
  for(var i=(d.headerRow>=0?d.headerRow+1:0); i<g.length; i++){
    var row=g[i]||[], code=normCod(row[cc]), title=txt(row[cd]);
    if(!esCodigo(code) || !/[A-Za-zÀ-ÿ]{2,}/.test(title)) continue;   // código real + título con letras
    if(!map[code]){ map[code]={title:title, nivel:code.split(".").length}; n++; }
  }
  return n>=3 ? {hoja:rn, map:map, n:n} : null;   // exige ≥3 entradas para fiarse
}

// --- aplica el mapa a las partidas de una hoja por PREFIJOS de código ---
function aplicar(medRows, map){
  var tocadas=0;
  medRows.forEach(function(r){
    var code=normCod(r.codigo); if(!code) return;
    var segs=code.split("."), L={}, hit=false;
    for(var k=1;k<segs.length;k++){ var pre=segs.slice(0,k).join("."); if(map[pre]){ L[map[pre].nivel]=map[pre].title; hit=true; } }
    if(!hit) return;
    tocadas++;
    r.division="";
    r.capitulo=L[1]||""; r.subcapitulo=L[2]||""; r.seccion=L[3]||"";
    var ruta=[]; Object.keys(L).map(Number).sort(function(a,b){return a-b;}).forEach(function(nv){ if(L[nv]) ruta.push(L[nv]); });
    r.ruta=ruta.join(" > ");
  });
  return tocadas;
}

// ---- escritor (idéntico al de normalizar.js) ----
function estilar(ws, caps, numCols){
  if(!ws["!ref"]) return;
  var rng=XLSX.utils.decode_range(ws["!ref"]); ws["!autofilter"]={ref:ws["!ref"]};
  var gris={patternType:"solid",fgColor:{rgb:"D9D9D9"}}, zeb={patternType:"solid",fgColor:{rgb:"F4F6F8"}}, W=[];
  for(var c=rng.s.c;c<=rng.e.c;c++){
    var mx=4, cap=(caps&&caps[c])||18, hd=ws[XLSX.utils.encode_cell({r:0,c:c})];
    if(hd){ mx=Math.max(mx,String(hd.v).length); hd.s={fill:gris,font:{sz:10,bold:true},alignment:{vertical:"center"}}; }
    for(var r=1;r<=rng.e.r;r++){
      var ad=XLSX.utils.encode_cell({r:r,c:c}), cell=ws[ad]||(ws[ad]={t:"s",v:""});
      var disp=String(cell.w!=null?cell.w:(cell.v==null?"":cell.v)); if(disp.length>mx) mx=disp.length;
      var st={font:{sz:10},alignment:{vertical:"center",wrapText:false}};
      if(r%2===0) st.fill=zeb;
      if(numCols&&numCols[c]) st.numFmt="#,##0.00";
      cell.s=st;
    }
    W.push({wch:Math.min(mx+2,cap)});
  }
  ws["!cols"]=W;
}
function filasCostes(estructura){
  var rows=[], abierto={1:false,2:false,3:false};
  var nivel={Capitulo:1,Subcapitulo:2,"Sección":3};
  var etiqueta={1:"TOTAL CAPÍTULO",2:"TOTAL SUBCAPÍTULO",3:"TOTAL SECCIÓN"};
  function cerrar(L){ for(var k=3;k>=L;k--){ if(abierto[k]){ rows.push(["","","",etiqueta[k],""]); abierto[k]=false; } } }
  estructura.forEach(function(r){
    if(r.nat==="__archivo__"){ cerrar(1); rows.push(["▼ "+r.partida,"","","",""]); return; }
    if(r.nat==="División"){ cerrar(1); rows.push([r.codigo||"", "División", "", r.partida||"", ""]); return; }
    var L=nivel[r.nat];
    if(L){ cerrar(L); rows.push([r.codigo||"", r.nat||"", r.ud||"", r.partida||"", ""]); abierto[L]=true; }
    else { var q=r.cantidad; if(typeof q==="number") q=Math.round(q*10000)/10000;
      rows.push([r.codigo||"", r.nat||"", r.ud||"", r.partida||"", (q===""||q==null?null:q)]); }
  });
  cerrar(1);
  return rows;
}
function estilarCostes(ws){
  if(!ws["!ref"]) return;
  var rng=XLSX.utils.decode_range(ws["!ref"]); ws["!autofilter"]={ref:ws["!ref"]};
  var gris={patternType:"solid",fgColor:{rgb:"D9D9D9"}};
  var fillNat={"División":"2F5496",Capitulo:"4472C4",Subcapitulo:"B4C6E7","Sección":"D9E1F2",__archivo__:"E8590C"};
  var W=[10,12,6,60,12];
  for(var c=rng.s.c;c<=rng.e.c;c++){
    var hd=ws[XLSX.utils.encode_cell({r:0,c:c})];
    if(hd) hd.s={fill:gris,font:{sz:10,bold:true},alignment:{vertical:"center"}};
    for(var r=1;r<=rng.e.r;r++){
      var ad=XLSX.utils.encode_cell({r:r,c:c}), cell=ws[ad]||(ws[ad]={t:"s",v:""});
      var nat=(ws[XLSX.utils.encode_cell({r:r,c:1})]||{}).v;
      var partida=(ws[XLSX.utils.encode_cell({r:r,c:3})]||{}).v;
      var esTotal=/^TOTAL /.test(String(partida||""));
      var st={font:{sz:10},alignment:{vertical:"center",wrapText:false}};
      if(c===4) st.numFmt="#,##0.00";
      if(fillNat[nat]){ st.fill={patternType:"solid",fgColor:{rgb:fillNat[nat]}};
        st.font={sz:10,bold:true,color:{rgb:(nat==="Sección"?"15191E":"FFFFFF")}}; }
      else if(esTotal){ st.fill={patternType:"solid",fgColor:{rgb:"D9D9D9"}}; st.font={sz:10,bold:true}; }
      cell.s=st;
    }
  }
  ws["!cols"]=W.map(function(w){return {wch:w};});
}
function escribir(wb, ruta){ fs.writeFileSync(ruta, XLSX.write(wb,{type:"buffer",bookType:"xlsx"})); }
function estPorHoja(medRows){   // estructura de costes regenerada por hoja (orden de aparición)
  var orden=[], grupos={};
  medRows.forEach(function(r){ var k=r.hoja||"Mediciones"; if(!grupos[k]){grupos[k]=[];orden.push(k);} grupos[k].push(r); });
  var est=[]; orden.forEach(function(k){ est=est.concat(core.estDesdeMed(grupos[k])); });
  return est;
}

// ---- CLI ----
var args=process.argv.slice(2), outDir=null, files=[];
for(var i=0;i<args.length;i++){ if(args[i]==="--out"){ outDir=args[++i]; } else files.push(args[i]); }
if(!files.length){ console.error("Uso: node mapa-jerarquia.js <archivo.xlsx> [--out <carpeta>]"); process.exit(1); }

var cargados=[];
files.forEach(function(f){
  var wb=XLSX.read(fs.readFileSync(f)), nombre=path.basename(f);
  var info=mapaDe(wb);
  console.log("\n════════ "+nombre+" ════════");
  if(!info){ console.log("  (no se encontró hoja Resumo/Índice con ≥3 entradas de jerarquía)");
    cargados.push({archivo:nombre, det:core.normalizar(wb,nombre,XLSX,{})}); return; }
  // volcar el mapa
  console.log("  Hoja maestra: «"+info.hoja+"»  ·  "+info.n+" entradas de jerarquía");
  var codes=Object.keys(info.map).sort(function(a,b){ return a.localeCompare(b,undefined,{numeric:true}); });
  codes.forEach(function(c){ var e=info.map[c]; console.log("    "+"  ".repeat(Math.max(0,e.nivel-1))+c+"  →  "+e.title.slice(0,46)+(e.nivel===1?"   [capítulo]":e.nivel===2?"   [subcapítulo]":e.nivel===3?"   [sección]":"   [ruta]")); });
  // cobertura: prefijos de capítulo/subcapítulo de las partidas que están en el mapa
  // cobertura: % de partidas que reciben capítulo (prefijo de 1 seg en el mapa) y
  // subcapítulo (prefijo de 2 segs). Los prefijos más profundos son nivel partida y
  // el resumo no los lista: no cuentan como fallo.
  var det=core.normalizar(wb,nombre,XLSX,{});
  var np=0, conCap=0, conSub=0;
  det.mediciones.forEach(function(r){ var code=normCod(r.codigo); if(!code) return; np++;
    var segs=code.split(".");
    if(segs.length>=2 && info.map[segs[0]]) conCap++;
    if(segs.length>=3 && info.map[segs.slice(0,2).join(".")]) conSub++;
  });
  console.log("  Cobertura: capítulo en "+(np?Math.round(100*conCap/np):0)+"% de partidas · subcapítulo en "+(np?Math.round(100*conSub/np):0)+"%  ("+np+" partidas)");
  if(outDir){ var toc=0; det.mediciones.forEach(function(){}); toc=aplicar(det.mediciones, info.map);
    det.estructura=estPorHoja(det.mediciones);
    console.log("  Aplicado el mapa a "+toc+" partidas.");
  }
  cargados.push({archivo:nombre, det:det});
});

if(outDir){
  var merged=core.acumular(cargados);
  var C=merged.CANON;
  var aoa=[C].concat(merged.mediciones.map(function(r){ return C.map(function(c){ return r[c]===""?null:r[c]; }); }));
  var ws=XLSX.utils.aoa_to_sheet(aoa);
  estilar(ws, [24,16,9,20,24,24,22,34,11,50,34,8,13], {12:1});
  var wb1=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb1,ws,"Mediciones");
  if(merged.notas.length){ var wn=XLSX.utils.json_to_sheet(merged.notas); estilar(wn,[16,9,80],{}); XLSX.utils.book_append_sheet(wb1,wn,"Notas"); }
  var base = cargados.length===1 ? cargados[0].archivo.replace(/\.(xlsx|xlsm|xls)$/i,"") : "mediciones_acumuladas";
  var f1=path.join(outDir, base+"_normalizado.xlsx"); escribir(wb1, f1); console.log("\nEscrito: "+f1);
  if(merged.estructura && merged.estructura.length){
    var ws2=XLSX.utils.aoa_to_sheet([merged.COSTHEAD].concat(filasCostes(merged.estructura)));
    estilarCostes(ws2);
    var wb2=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb2,ws2,"Hoja de costes");
    var f2=path.join(outDir, base+"_hoja-de-costes.xlsx"); escribir(wb2, f2); console.log("Escrito: "+f2);
  }
} else {
  console.log("\n(añade --out <carpeta> para aplicar el mapa y escribir los Excel corregidos)");
}

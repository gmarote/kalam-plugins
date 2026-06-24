#!/usr/bin/env node
/* Ejecutor del plugin hopper — hace EXACTAMENTE lo mismo que la app.
   Usa el ÚNICO motor (../../../app/normalizar.core.js); no reimplementa nada.
   Lee uno o varios MQT, escribe el Excel normalizado y la hoja de costes, y
   emite un informe de diagnóstico (confianza por hoja, avisos, correcciones de
   capa 3) para guiar la parte interactiva con los casos difíciles.

   Uso:  node normalizar.js <archivo.xlsx> [archivo2 …] [--out <carpeta>]
   No instala nada: extrae el SheetJS embebido en el HTML de la app. */
"use strict";
var fs=require("fs"), path=require("path");
var APP=path.join(__dirname, "..", "..", "..", "app");

// --- SheetJS con estilos: el mismo que embebe la app (sin dependencias nuevas) ---
function cargarXLSX(){
  try { return require("xlsx-js-style"); } catch(e){}
  try { return require("xlsx"); } catch(e){}
  var html=fs.readFileSync(path.join(APP,"hopper_multicapa.html"),"utf8");
  var i=html.indexOf("xlsx-js-style.min.js");
  var s=html.indexOf("*/",i)+2, e=html.indexOf("</script>",s);
  var mod={exports:{}};
  new Function("module","exports","require","window", html.slice(s,e))(mod,mod.exports,undefined,globalThis);
  return mod.exports;
}
var XLSX=cargarXLSX();
var core=require(path.join(APP,"normalizar.core.js"));

// --- estilos (idénticos a la app) ---
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

// hoja de costes FORMULADA (plantilla de estudios, A..AV): coloca etiquetas en la fila
// (startRow-1) y los datos desde startRow, escribiendo celdas-fórmula reales ({f}).
function hojaFormulada(cf){
  var sr=cf.startRow, ws={}, nC=cf.labels.length;
  var NUM={4:1,6:1,9:1,11:1,14:1,17:1,20:1,23:1,24:1,26:1,28:1,31:1,37:1,38:1,39:1,40:1,41:1,42:1,44:1,47:1};
  // bandas por tipo de fila: azules degradados (capítulo más intenso) y gris para totales
  var BAND={ "División":{bg:"1F3864",fg:"FFFFFF"}, "Capitulo":{bg:"2F5496",fg:"FFFFFF"},
             "Subcapitulo":{bg:"8EAADB",fg:"1A1A1A"}, "Sección":{bg:"D9E1F2",fg:"1A1A1A"} };
  cf.labels.forEach(function(lab,c){ ws[XLSX.utils.encode_cell({r:sr-2,c:c})]={t:"s",v:lab,s:{font:{bold:true,sz:9},fill:{patternType:"solid",fgColor:{rgb:"D9D9D9"}},alignment:{wrapText:true,vertical:"center"}}}; });
  cf.rows.forEach(function(row,ri){
    var er=sr-1+ri, nat=String(row[1]||""), esTot=/^TOTAL/.test(String(row[3]||""));
    var band = BAND[nat] ? BAND[nat] : (esTot ? {bg:"D9D9D9",fg:"1A1A1A"} : null);
    for(var c=0;c<nC;c++){ var cell=row[c];
      if(cell==null && !band) continue;                          // partida: solo celdas con contenido; banda: toda la fila
      var ad=XLSX.utils.encode_cell({r:er,c:c}), o;
      if(cell==null) o={t:"s",v:""};
      else if(typeof cell==="object" && cell.f!=null) o={t:"n",f:cell.f,v:0};   // SheetJS exige valor cacheado; Excel recalcula al abrir/pegar
      else if(typeof cell==="number") o={t:"n",v:cell};
      else o={t:"s",v:String(cell)};
      var s={font:{sz:9}}; if(NUM[c]) s.numFmt="#,##0.00";
      if(band){ s.fill={patternType:"solid",fgColor:{rgb:band.bg}}; s.font={sz:9,bold:true,color:{rgb:band.fg}}; }
      o.s=s; ws[ad]=o;
    }
  });
  var endR=sr-1+cf.rows.length-1, ref=XLSX.utils.encode_range({s:{r:sr-2,c:0},e:{r:Math.max(endR,sr-2),c:nC-1}});
  ws["!ref"]=ref; ws["!autofilter"]={ref:ref};
  var W=[10,12,6,60,11]; for(var c=5;c<nC;c++) W.push(13); ws["!cols"]=W.map(function(w){return {wch:w};});
  return ws;
}

// --- CLI ---
var args=process.argv.slice(2), outDir=".", files=[];
for(var i=0;i<args.length;i++){ if(args[i]==="--out"){ outDir=args[++i]; } else files.push(args[i]); }
if(!files.length){ console.error("Uso: node normalizar.js <archivo.xlsx> [...] [--out <carpeta>]"); process.exit(1); }

var cargados=files.map(function(f){
  var wb=XLSX.read(fs.readFileSync(f),{cellStyles:false});
  return {archivo:path.basename(f), det:core.normalizar(wb, path.basename(f), XLSX, {})};
});
var merged=core.acumular(cargados);

// 1) Excel normalizado (Mediciones + Notas)
var C=merged.CANON;
var aoa=[C].concat(merged.mediciones.map(function(r){ return C.map(function(c){ return r[c]===""?null:r[c]; }); }));
var ws=XLSX.utils.aoa_to_sheet(aoa);
estilar(ws, [24,16,9,20,24,24,22,34,11,50,34,8,13], {12:1});
var wb1=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb1,ws,"Mediciones");
if(merged.notas.length){ var wn=XLSX.utils.json_to_sheet(merged.notas); estilar(wn,[16,9,80],{}); XLSX.utils.book_append_sheet(wb1,wn,"Notas"); }
var base = cargados.length===1 ? cargados[0].archivo.replace(/\.(xlsx|xlsm|xls)$/i,"") : "mediciones_acumuladas";
var f1=path.join(outDir, base+"_normalizado.xlsx"); escribir(wb1, f1);

// 2) Hoja de costes FORMULADA (plantilla de estudios, A..AV; pegar a partir de la fila 7)
var f2=null;
if(merged.estructura && merged.estructura.length){
  var cf=core.costesFormulados(merged.estructura, 7);
  var ws2=hojaFormulada(cf);
  var wb2=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb2,ws2,"HOJA DE ESTUDIOS");
  wb2.Workbook={CalcPr:{fullCalcOnLoad:true}};   // Excel recalcula las fórmulas al abrir
  f2=path.join(outDir, (cargados.length===1?base:"estudio_acumulado")+"_hoja-de-costes.xlsx"); escribir(wb2, f2);
}

// 3) Informe de diagnóstico (para guiar los casos difíciles)
var fuente=merged.hojas.filter(function(h){return !h.excluida;});
var num=0,den=0; fuente.forEach(function(h){ var w=h.nMed||0; num+=(h.confianza==null?1:h.confianza)*w; den+=w; });
var confGlobal=den?Math.round(100*num/den):100;
var revisar=fuente.filter(function(h){return (h.confianza!=null&&h.confianza<1)||(h.avisos&&h.avisos.length);});
if(merged.esMQT===false){
  console.log("\n⚠️  ESTO NO PARECE UN MQT DE MEDICIONES.");
  console.log("   No se han encontrado columnas de medición habituales (unidad + cantidad).");
  console.log("   Se ha procesado igualmente, pero NO se evalúa la fiabilidad. Revisa el archivo.");
}
console.log("\n════════ HOPPER · "+merged.mediciones.length+" mediciones · "+
            (merged.esMQT===false ? "(sin evaluación de fiabilidad: no parece un MQT)" : "confianza global "+confGlobal+"%")+" ════════");
console.log("Escrito: "+f1); if(f2) console.log("Escrito: "+f2);
console.log("\nPor hoja:");
merged.hojas.forEach(function(h){
  var est = h.excluida ? (h.noFuente?"descartada (no-fuente)":"duplicada") : (Math.round((h.confianza==null?1:h.confianza)*100)+"%");
  console.log("  ["+est+"] "+h.archivo+" › "+h.hoja+"  ("+(h.nMed||0)+" part.)"+(h.capa3?"  ✓ "+h.capa3:""));
  (h.avisos||[]).forEach(function(a){ if(!h.excluida) console.log("        ⚠ "+a); });
});
if(revisar.length){
  console.log("\n⟹ "+revisar.length+" hoja(s) a revisar. Si la confianza es baja por «jerarquía rota», abre el");
  console.log("  original y aplica el playbook de SKILL.md (§ Casos difíciles) para añadir/ajustar la receta.");
} else {
  console.log("\n⟹ Todo limpio. Entrega los dos Excel.");
}

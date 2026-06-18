/* Motor de normalización de MQT — Capa 1 (sin IA).
   Port de assets/extraer.py: reglas universales + familias código/formato.
   Funciona en navegador (window.HopperCore) y en Node (module.exports). */
(function (root) {
  "use strict";

  var CANON = ["archivo","hoja","fila_origen","capitulo","subcapitulo","seccion",
               "ruta","codigo","partida","detalle","unidad","medicion",
               "precio_unitario","importe"];

  function txt(v){ if(v===null||v===undefined) return ""; if(typeof v==="number"&&isNaN(v)) return ""; return String(v).trim(); }

  function toNum(v){
    if(typeof v==="number") return isNaN(v)?null:v;
    var s = txt(v).replace(/€/g,"").replace(/\s/g,"");
    if(!s) return null;
    if(s.indexOf(",")>=0) s = s.replace(/\./g,"").replace(/,/g,".");   // PT: coma decimal, punto millares
    var n = Number(s);
    return isNaN(n)?null:n;
  }

  function isCaps(s){ var letters=s.replace(/[^A-Za-zÀ-ÿ]/g,""); return letters.length>2 && s===s.toUpperCase(); }
  var STRUCT=/^[A-Za-z]{0,4}\d*(\.[A-Za-z0-9]+)*$/;
  function isStructCode(s){ return STRUCT.test(s) && /\d/.test(s) && s.toUpperCase().indexOf("CG")!==0; }
  function isLetterChapter(s){ return /^[A-Za-z]{1,4}$/.test(s); }

  function rec(o){
    var r={}; CANON.forEach(function(c){ r[c]=""; });
    Object.keys(o).forEach(function(k){ r[k]=o[k]; });
    if(r.medicion!==""&&r.medicion!==null&&r.precio_unitario!==""&&r.precio_unitario!==null)
      r.importe = Math.round(Number(r.medicion)*Number(r.precio_unitario)*100)/100;
    return r;
  }

  function cell(row,j){ return (j!=null && j<row.length) ? row[j] : null; }

  // ---- localizar cabecera por contenido aproximado ----
  function findHeader(grid, col, markers){
    for(var i=0;i<grid.length;i++){
      var c = txt(cell(grid[i],col)).toLowerCase().replace(/\n/g," ");
      for(var m=0;m<markers.length;m++) if(c.indexOf(markers[m])>=0) return i;
    }
    return -1;
  }

  // ---- auto-detección de mapeo de columnas y familia (capa 1 sin IA) ----
  var ROLE_MARKERS = {
    code: ["item","art","códig","codig","nº","n.º"],
    desc: ["design","descri","trabalho","articulado"],
    unit: ["un.","unid","und"," un","unit"],   // "unit" también; se desempata abajo
    qty:  ["quant","qtd","qte","medi","totais","total"],
    price:["preç","prec","custo","valor"]
  };
  function roleOf(label){
    var s=label.toLowerCase().replace(/\n/g," ").trim();
    if(!s) return null;
    // orden importa: precio/€ antes que "total" (un "Total €" es importe, no cantidad)
    if(/preç|prec|custo|€|valor/.test(s)) return "price";
    if(/design|descri|trabalho|articulado/.test(s)) return "desc";
    if(/quant|qtd|qte|medi/.test(s)) return "qty";   // cantidad: NO "total" a secas (ambiguo)
    if(/^un\.?$|unid|^und$|unidade/.test(s)) return "unit";
    if(/item|^art|artigo|códig|codig|nº|n\.º/.test(s)) return "code";
    return null;
  }
  function autoDetect(grid){
    // candidato a cabecera: fila con >=3 etiquetas reconocibles
    var best=-1,bestScore=0;
    for(var i=0;i<Math.min(grid.length,40);i++){
      var sc=0; for(var j=0;j<grid[i].length;j++){ if(roleOf(txt(cell(grid[i],j)))) sc++; }
      if(sc>bestScore){ bestScore=sc; best=i; }
    }
    var cols={}, header = best>=0?grid[best]:[];
    if(best>=0){
      for(var j2=0;j2<header.length;j2++){
        var r=roleOf(txt(cell(header,j2)));
        if(r && cols[r]==null) cols[r]=j2;
      }
    }
    // valores por defecto si no se detectaron
    if(cols.code==null) cols.code=0;
    if(cols.desc==null || cols.desc===cols.code) cols.desc=cols.code+1;
    if(cols.unit==null) cols.unit=cols.desc+1;
    if(cols.qty==null)  cols.qty=cols.unit+1;
    if(cols.price==null)cols.price=cols.qty+1;
    // familia: ¿hay códigos estructurales jerárquicos en la columna de código?
    var struct=0,total=0;
    for(var k=(best>=0?best+1:0);k<grid.length;k++){
      var cc=txt(cell(grid[k],cols.code));
      if(!cc) continue; total++;
      if(isStructCode(cc) && cc.split(".").length>=2) struct++;
    }
    var familia = (struct>=3) ? "codigo" : "formato";
    return { headerRow: best, cols: cols, familia: familia, headerScore: bestScore };
  }

  // ---- familia CÓDIGO ----
  function parseCodigo(grid, cols, archivo, hoja, headerRow, stats){
    var out=[], titles={}, start = headerRow>=0 ? headerRow+1 : 0;
    for(var i=start;i<grid.length;i++){
      var row=grid[i], fila=i+1;
      var code=txt(cell(row,cols.code)), desc=txt(cell(row,cols.desc)), unit=txt(cell(row,cols.unit));
      if(unit==="0") unit="";
      var qty=toNum(cell(row,cols.qty)), price=toNum(cell(row,cols.price));
      if(!code && !desc && qty===null){ stats.vacia++; continue; }
      if(/^(sub\s*total|total)\b/i.test(desc) && qty===null){ stats.subtotal++; continue; }
      if(isLetterChapter(code) && qty===null){ stats.titulo++; titles={1:desc}; continue; }
      if(!isStructCode(code)){
        if(qty!==null && unit){                       // ítem real sin código útil: NO se pierde
          stats.partida++;
          var rutaP = rutaDe(titles, 99);
          out.push(rec({archivo:archivo,hoja:hoja,fila_origen:fila,
            capitulo:titles[1]||"",subcapitulo:titles[2]||"",seccion:titles[3]||"",
            ruta:rutaP,codigo:"",partida:desc,unidad:unit,medicion:qty,
            precio_unitario:(price===null?"":price)}));
        } else { (desc?stats.nota++:stats.vacia++); if(desc) out.push(["__nota__",hoja,fila,desc]); }
        continue;
      }
      var nivel = code.split(".").length;
      if(qty!==null && unit){
        stats.partida++;
        out.push(rec({archivo:archivo,hoja:hoja,fila_origen:fila,
          capitulo:(nivel>1?(titles[1]||""):""),
          subcapitulo:(nivel>2?(titles[2]||""):""),
          seccion:(nivel>3?(titles[3]||""):""),
          ruta:rutaDe(titles,nivel),codigo:code,partida:desc,unidad:unit,medicion:qty,
          precio_unitario:(price===null?"":price)}));
      } else {
        stats.titulo++; titles[nivel]=desc;
        Object.keys(titles).forEach(function(k){ if(+k>nivel) delete titles[k]; });
      }
    }
    return out;
  }
  function rutaDe(titles, nivel){
    return Object.keys(titles).map(Number).filter(function(k){return k<nivel && titles[k];})
           .sort(function(a,b){return a-b;}).map(function(k){return titles[k];}).join(" > ");
  }

  // ---- familia FORMATO ----
  function parseFormato(grid, cols, archivo, hoja, headerRow, capituloHoja, stats){
    var capitulo = capituloHoja, out=[], subcap="", partida=null;
    if(headerRow>=0){ var d=txt(cell(grid[headerRow],cols.desc)); capitulo=d||capituloHoja; }
    var start = headerRow>=0?headerRow+1:0;
    for(var i=start;i<grid.length;i++){
      var row=grid[i], fila=i+1;
      var code=txt(cell(row,cols.code)), desc=txt(cell(row,cols.desc)), unit=txt(cell(row,cols.unit));
      if(unit==="0") unit="";
      var qty=toNum(cell(row,cols.qty)), price=toNum(cell(row,cols.price));
      if(desc==="DESCRITIVO") continue;
      if(!code && !desc && qty===null){ stats.vacia++; continue; }
      if(/^total\b/i.test(desc) && qty===null){ stats.subtotal++; continue; }
      var ruta=[capitulo,subcap].filter(Boolean).join(" > ");
      if(code){
        if(isCaps(desc) && qty===null){ subcap=desc; partida=null; stats.titulo++; continue; }
        partida={code:code,desc:desc}; stats.partida++;
        if(qty!==null) out.push(rec({archivo:archivo,hoja:hoja,fila_origen:fila,
          capitulo:capitulo,subcapitulo:subcap,ruta:ruta,codigo:code,partida:desc,
          unidad:unit,medicion:qty,precio_unitario:(price===null?"":price)}));
        continue;
      }
      if(qty!==null){
        stats.parcial++; var base=partida||{code:"",desc:""};
        out.push(rec({archivo:archivo,hoja:hoja,fila_origen:fila,capitulo:capitulo,
          subcapitulo:subcap,ruta:ruta,codigo:base.code,partida:base.desc,detalle:desc,
          unidad:unit,medicion:qty,precio_unitario:(price===null?"":price)}));
      } else if(desc){ stats.nota++; out.push(["__nota__",hoja,fila,desc]); }
    }
    return out;
  }

  function nuevoStats(){ return {titulo:0,partida:0,parcial:0,nota:0,subtotal:0,vacia:0}; }
  function esExcluida(nombre){ return /resumo|resumen|^folha\d|^sheet\d|^hoja\d/i.test(nombre.trim()); }

  // ---- API principal: normaliza un workbook (de XLSX.read) ----
  // overrides: { hojaNombre: {familia, headerRow, cols, excluir} }  para la UI
  function normalizar(wb, archivo, XLSX, overrides){
    overrides = overrides||{};
    var medic=[], notas=[], info={};
    wb.SheetNames.forEach(function(hoja){
      var ws=wb.Sheets[hoja];
      var grid=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null});
      var det=autoDetect(grid);
      var ov=overrides[hoja]||{};
      var excl = ov.excluir!=null ? ov.excluir : esExcluida(hoja);
      var familia = ov.familia||det.familia;
      var headerRow = ov.headerRow!=null?ov.headerRow:det.headerRow;
      var cols = ov.cols||det.cols;
      info[hoja]={familia:familia,headerRow:headerRow,cols:cols,excluida:excl,
                  headerScore:det.headerScore,filas:grid.length};
      if(excl){ info[hoja].stats=nuevoStats(); return; }
      var stats=nuevoStats(), res;
      if(familia==="codigo") res=parseCodigo(grid,cols,archivo,hoja,headerRow,stats);
      else res=parseFormato(grid,cols,archivo,hoja,headerRow,hoja,stats);
      res.forEach(function(r){ if(Array.isArray(r)) notas.push({hoja:r[1],fila_origen:r[2],nota:r[3]}); else medic.push(r); });
      info[hoja].stats=stats;
    });
    return { mediciones:medic, notas:notas, info:info, CANON:CANON };
  }

  var API={CANON:CANON,txt:txt,toNum:toNum,isStructCode:isStructCode,autoDetect:autoDetect,
           parseCodigo:parseCodigo,parseFormato:parseFormato,normalizar:normalizar,esExcluida:esExcluida};
  if(typeof module!=="undefined"&&module.exports) module.exports=API;
  else root.HopperCore=API;
})(typeof window!=="undefined"?window:this);

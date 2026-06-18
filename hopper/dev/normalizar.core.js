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

  // rejilla de la hoja alineada a A1: grid[i] == fila (i+1) real de Excel, col 0 == A.
  // (sheet_to_json cuenta desde el rango !ref, que a veces empieza en A8 y desfasa la fila)
  function gridDe(ws, XLSX){
    if(!ws || !ws["!ref"]) return [];
    var rng=XLSX.utils.decode_range(ws["!ref"]);
    var ref=XLSX.utils.encode_range({s:{r:0,c:0}, e:{r:rng.e.r, c:rng.e.c}});
    return XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null,blankrows:true,range:ref});
  }

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

  // ---- autoevaluación: avisos que EXPLICAN qué pasó y qué hacer (sin jerga) ----
  function unidadSospechosa(u){ u=String(u).trim(); return u.length>6 || (u!=="" && /^[\d.,]+$/.test(u)); }
  function colLetra(j){
    j=Number(j); if(isNaN(j)||j<0) return "?";
    var s=""; j++; while(j>0){ var m=(j-1)%26; s=String.fromCharCode(65+m)+s; j=Math.floor((j-1)/26); }
    return s;
  }
  function avisosDe(inf, medRows){
    var a=[], c=inf.cols||{}, np=medRows.length;
    var mapeo="descripción "+colLetra(c.desc)+" · unidad "+colLetra(c.unit)+" · cantidad "+colLetra(c.qty);

    if(np===0){
      a.push("Sin partidas. Si es un resumen, notas o portada, ignórala; si esperabas mediciones, las columnas no cuadran (busqué "+mapeo+").");
      return a;  // sin partidas, el resto de avisos no aporta
    }
    if(inf.headerRow<0)
      a.push("Sin cabecera clara; asumí columnas: "+mapeo+". Salieron "+np+" partidas — revísalas.");
    else if(inf.headerScore<3)
      a.push("Cabecera poco clara (fila "+(inf.headerRow+1)+"); asumí columnas: "+mapeo+". "+np+" partidas — comprueba las columnas.");

    var us={}; medRows.forEach(function(r){ var u=String(r.unidad||"").trim(); if(u&&unidadSospechosa(u)) us[u]=1; });
    var ul=Object.keys(us);
    if(ul.length)
      a.push("Unidades raras en la columna "+colLetra(c.unit)+" ("+ul.slice(0,5).join(", ")+"); quizá no sea la de unidades.");

    var z=medRows.filter(function(r){return r.medicion===0;}).length;
    if(z>0)
      a.push(z+" partida"+(z>1?"s":"")+" con cantidad 0: puede ser normal, o que la columna "+colLetra(c.qty)+" no sea la de cantidad.");
    return a;
  }

  // ---- huella de ítems de una hoja, para detectar duplicados entre hojas ----
  function clavesDe(medRows){
    var s={};
    medRows.forEach(function(r){
      var k=((r.codigo||"")+"¶"+(r.partida||"")).toLowerCase().replace(/\s+/g," ").trim();
      if(k!=="¶") s[k]=1;
    });
    return s;
  }
  function contencion(a,b){            // fracción de claves de A presentes en B
    var ka=Object.keys(a); if(!ka.length) return 0;
    var n=0; for(var i=0;i<ka.length;i++) if(b[ka[i]]) n++;
    return n/ka.length;
  }

  // ---- API principal: normaliza un workbook (de XLSX.read) ----
  // Procesa TODAS las hojas (no se descarta nada por nombre) y descarta solo las
  // que resulten ser duplicado/subconjunto de otra hoja mayor (evita doble conteo).
  function normalizar(wb, archivo, XLSX, overrides){
    overrides = overrides||{};
    var info={}, data={}, nombres=wb.SheetNames;

    // 1) parsear todas las hojas
    nombres.forEach(function(hoja){
      var grid=gridDe(wb.Sheets[hoja], XLSX);
      var det=autoDetect(grid), ov=overrides[hoja]||{};
      var familia=ov.familia||det.familia;
      var headerRow=ov.headerRow!=null?ov.headerRow:det.headerRow;
      var cols=ov.cols||det.cols;
      info[hoja]={familia:familia,headerRow:headerRow,cols:cols,headerScore:det.headerScore,
                  filas:grid.length,excluida:false,motivo:""};
      var stats=nuevoStats(), res, medRows=[], notasRows=[];
      if(familia==="codigo") res=parseCodigo(grid,cols,archivo,hoja,headerRow,stats);
      else res=parseFormato(grid,cols,archivo,hoja,headerRow,hoja,stats);
      res.forEach(function(r){ if(Array.isArray(r)) notasRows.push({hoja:r[1],fila_origen:r[2],nota:r[3]}); else medRows.push(r); });
      info[hoja].stats=stats;
      info[hoja].nMed=medRows.length;        // partidas emitidas (lo que va a la salida)
      data[hoja]={medRows:medRows,notas:notasRows,claves:clavesDe(medRows)};
    });

    // 2) detectar duplicados: una hoja sobra si está contenida (>=80%) en otra mayor
    nombres.forEach(function(A){
      var ka=data[A].claves, na=Object.keys(ka).length;
      if(na===0) return;
      for(var j=0;j<nombres.length;j++){
        var B=nombres[j]; if(B===A) continue;
        var nb=Object.keys(data[B].claves).length;
        var mayor = nb>na || (nb===na && j<nombres.indexOf(A));
        var c=contencion(ka, data[B].claves);
        if(mayor && c>=0.8){
          info[A].excluida=true;
          info[A].motivo="duplicada de «"+B+"» ("+Math.round(100*c)+"% de sus ítems ya están en "+B+")";
          break;
        }
      }
    });

    // 3) salida desde las hojas no descartadas + avisos
    var medic=[], notas=[];
    nombres.forEach(function(h){
      var i=info[h];
      if(i.excluida){ i.avisos=[i.motivo]; return; }
      medic=medic.concat(data[h].medRows);
      notas=notas.concat(data[h].notas);
      i.avisos=avisosDe(i, data[h].medRows);
    });
    return { mediciones:medic, notas:notas, info:info, CANON:CANON };
  }

  // ---- acumular varios ficheros en una sola salida (dedup a nivel de fichero) ----
  // items: [{archivo, det}]  (det = resultado de normalizar). Un fichero se descarta
  // si sus ítems están contenidos (>=80%) en otro mayor (p. ej. cargar dos veces el
  // mismo). Especialidades distintas (Ferragial ARQ vs ESP) NO se solapan -> se suman.
  function acumular(items){
    var claves=items.map(function(it){ return clavesDe(it.det.mediciones); });
    var n=claves.map(function(k){ return Object.keys(k).length; });
    var archivos=items.map(function(it){ return {nombre:it.archivo, nMed:it.det.mediciones.length, excluido:false, motivo:""}; });
    for(var a=0;a<items.length;a++){
      if(n[a]===0) continue;
      for(var b=0;b<items.length;b++){
        if(b===a) continue;
        var mayor = n[b]>n[a] || (n[b]===n[a] && b<a);
        var c=contencion(claves[a], claves[b]);
        if(mayor && c>=0.8){ archivos[a].excluido=true; archivos[a].motivo="duplicado de «"+items[b].archivo+"» ("+Math.round(100*c)+"%)"; break; }
      }
    }
    var medic=[], notas=[], hojas=[];
    items.forEach(function(it,i){
      if(archivos[i].excluido) return;
      medic=medic.concat(it.det.mediciones);
      notas=notas.concat(it.det.notas);
      Object.keys(it.det.info).forEach(function(h){
        var inf=it.det.info[h];
        hojas.push({archivo:it.archivo,hoja:h,nMed:inf.nMed||0,excluida:inf.excluida,
                    motivo:inf.motivo,avisos:inf.avisos||[]});
      });
    });
    return { mediciones:medic, notas:notas, archivos:archivos, hojas:hojas, CANON:CANON };
  }

  var API={CANON:CANON,txt:txt,toNum:toNum,isStructCode:isStructCode,autoDetect:autoDetect,
           parseCodigo:parseCodigo,parseFormato:parseFormato,normalizar:normalizar,
           clavesDe:clavesDe,contencion:contencion,acumular:acumular};
  if(typeof module!=="undefined"&&module.exports) module.exports=API;
  else root.HopperCore=API;
})(typeof window!=="undefined"?window:this);

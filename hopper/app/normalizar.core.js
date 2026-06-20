/* Motor de normalización de MQT — Capa 1 (sin IA).
   Port de assets/extraer.py: reglas universales + familias código/formato.
   Funciona en navegador (window.HopperCore) y en Node (module.exports). */
(function (root) {
  "use strict";

  var CANON = ["archivo","hoja","fila_origen","capitulo","subcapitulo","seccion",
               "ruta","codigo","partida","detalle","unidad","medicion"];

  // Excel 2 «hoja de costes»: estructura + cantidad para volcar al sistema de costes.
  var COSTHEAD = ["Código","Nat","Ud","Partida","CanPres"];

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
  function isLetterChapter(s){ return /^[A-Za-z]{1,4}\.?$/.test(s); }   // A, B, AB… con punto opcional (A., B.)

  function rec(o){
    var r={}; CANON.forEach(function(c){ r[c]=""; });
    CANON.forEach(function(c){ if(c in o) r[c]=o[c]; });   // solo columnas del esquema
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
  // ¿el valor es un código con punto? (1.1, 2.1.1, E.1)
  function esCodigoPunteado(s){ return isStructCode(s) && s.indexOf(".")>=0; }
  // máximo nº de "hermanos": hijos distintos del mismo padre (1.1,1.2,…,1.11 -> 11).
  // Para 2 niveles exige que el PADRE exista como entero suelto en la columna (1, 2…),
  // así una columna de cantidades decimales (2.5, 2.7…) no se confunde con código.
  function maxHermanos(codes, intset){
    var g={}, mx=0;
    for(var i=0;i<codes.length;i++){ var p=codes[i].lastIndexOf("."); if(p<0) continue;
      var pre=codes[i].slice(0,p); g[pre]=(g[pre]||0)+1; }
    for(var k in g){
      var vale = k.indexOf(".")>=0 || (intset&&intset[k]);   // hijo de padre dotado, o padre entero presente
      if(vale && g[k]>mx) mx=g[k];
    }
    return mx;
  }
  var UNID=/^(m|m2|m3|m²|m³|ml|cm|mm|km|kg|kgs|ton|t|un|u|und|uni|unid|vg|cj|conj|pç|pc|pcs|lote|h|hr|hrs|dia|dias|mes|mês|gl|l|lt|saco|saca|fg|ud|uds|par)\.?$/i;
  function esUnidad(s){ s=String(s).trim(); return UNID.test(s) || (s.length<=4 && /^[A-Za-zºª²³]+\.?$/.test(s)); }
  function ncols(grid){ var n=0; for(var i=0;i<grid.length;i++) if(grid[i]&&grid[i].length>n) n=grid[i].length; return n; }

  // estimación INDEPENDIENTE del mapeo: nº de filas del original que "parecen" una
  // medición (tienen un número > 0 y una unidad real en algún sitio). Sirve para
  // reconciliar: si emitimos muchas menos partidas que esto, hemos perdido datos.
  function estimaMedidas(grid, start){
    var est=0;
    for(var r=start;r<grid.length;r++){
      var rw=grid[r]; if(!rw) continue; var hasNum=false, hasUnit=false;
      for(var k=0;k<rw.length;k++){
        var s=txt(cell(rw,k)); if(!s) continue;
        var nu=toNum(s); if(nu!==null && nu>0) hasNum=true;
        if(UNID.test(s)) hasUnit=true;
        if(hasNum&&hasUnit){ est++; break; }
      }
    }
    return est;
  }

  // mapeo por etiquetas de cabecera (respaldo cuando el contenido no decide)
  function labelCols(grid, headerRow){
    var cols={}, header = headerRow>=0?grid[headerRow]:[];
    for(var j=0;j<header.length;j++){ var r=roleOf(txt(cell(header,j))); if(r&&cols[r]==null) cols[r]=j; }
    return cols;
  }

  function autoDetect(grid){
    // 1) fila de cabecera por etiquetas (para saber dónde empiezan los datos)
    var best=-1,bestScore=0;
    for(var i=0;i<Math.min(grid.length,40);i++){
      var sc=0,row=grid[i]||[]; for(var j=0;j<row.length;j++){ if(roleOf(txt(cell(row,j)))) sc++; }
      if(sc>bestScore){ bestScore=sc; best=i; }
    }
    var headerRow=best, start=best>=0?best+1:0, N=ncols(grid);

    // 2) métricas por columna sobre los datos
    var met=[]; for(var c=0;c<N;c++) met[c]={num:0,numNZ:0,unit:0,textLen:0,textN:0,segMax:0,letras:0,codeset:{},intset:{}};
    var seen=0;
    for(var r=start;r<grid.length && seen<400;r++){
      var rw=grid[r]; if(!rw) continue; var any=false;
      for(var k=0;k<N;k++){
        var s=txt(cell(rw,k)); if(!s) continue; any=true;
        if(/^\d+$/.test(s)) met[k].intset[s]=1;                 // enteros sueltos (posibles padres)
        if(esCodigoPunteado(s)){ met[k].codeset[s]=1; var sg=s.split(".").length; if(sg>met[k].segMax) met[k].segMax=sg;
          if(/^[A-Za-z]{1,4}[.\d]/.test(s)) met[k].letras++; }
        var nu=toNum(s);
        if(nu!==null){ met[k].num++; if(nu!==0) met[k].numNZ++; }
        else if(s.length>3){ met[k].textLen+=s.length; met[k].textN++; }
        if(esUnidad(s)) met[k].unit++;
      }
      if(any) seen++;
    }
    // puntuación de "columna de código": jerarquía real (3+ niveles, prefijo de letra o muchos hermanos)
    for(var q=0;q<N;q++){
      var codes=Object.keys(met[q].codeset); met[q].nCodes=codes.length; met[q].herm=maxHermanos(codes, met[q].intset);
      met[q].esCodigo = codes.length>=3 && (met[q].segMax>=3 || met[q].letras>=2 || met[q].herm>=3);
    }

    // etiquetas de cada columna (banda de cabecera: fila ±1, por si va a dos filas)
    var lbl=[]; for(var L=0;L<N;L++){ var t=""; if(headerRow>=0) for(var rr=headerRow-1;rr<=headerRow+1;rr++) if(rr>=0&&rr<grid.length) t+=" "+txt(cell(grid[rr]||[],L)); lbl[L]=t.toLowerCase().replace(/\n/g," "); }
    function esDim(s){ return /comp|larg|\balt|perim|perím|área|\barea|prof|parc|parte|dimens/.test(s); }   // columnas de dimensiones
    function esQtyLbl(s){ return /\bqt\b|qtd|qte|quant|medi[cç]/.test(s); }                                  // cantidad (NO "total" a secas)
    function esPriceLbl(s){ return /pre[cç]|custo|€|valor|p\.?\s?unit|or[cç]ament|import/.test(s); }          // precio/importe

    // 3) asignar roles por contenido (con respaldo de etiquetas/posición)
    var used={}, cols={}, lab=labelCols(grid, headerRow);
    function pick(role, scoreFn){
      var bi=-1,bv=0; for(var a=0;a<N;a++){ if(used[a]) continue; var v=scoreFn(met[a],a); if(v>bv){bv=v;bi=a;} }
      if(bi>=0){ cols[role]=bi; used[bi]=1; }
    }
    pick("code", function(m){ return m.esCodigo ? m.nCodes : 0; });            // jerarquía real
    pick("desc", function(m){ return m.textN ? m.textLen/m.textN : 0; });      // texto más largo
    pick("unit", function(m){ return m.unit; });                               // tokens de unidad
    pick("qty",  function(m,a){                                                // cantidad: QUANT/QT, NUNCA dimensiones/precio
      if(esDim(lbl[a]) || esPriceLbl(lbl[a])) return 0;
      return m.numNZ + (esQtyLbl(lbl[a]) ? 1e7 : 0);
    });
    pick("price",function(m,a){ return m.num + (esPriceLbl(lbl[a]) ? 1e7 : 0); });
    ["code","desc","unit","qty","price"].forEach(function(role,idx){
      if(cols[role]==null) cols[role] = (lab[role]!=null && !used[lab[role]] ? lab[role] : idx);
    });

    var familia = (cols.code!=null && met[cols.code] && met[cols.code].esCodigo) ? "codigo" : "formato";
    return { headerRow:headerRow, cols:cols, familia:familia, headerScore:bestScore };
  }

  // ---- familia CÓDIGO ----
  function parseCodigo(grid, cols, archivo, hoja, headerRow, stats, est){
    var out=[], titles={}, cur=null, curEst=null, start = headerRow>=0 ? headerRow+1 : 0;
    function pushEst(o){ if(est) est.push(o); curEst=o; return o; }
    for(var i=start;i<grid.length;i++){
      var row=grid[i], fila=i+1;
      var code=txt(cell(row,cols.code)), desc=txt(cell(row,cols.desc)), unit=txt(cell(row,cols.unit));
      if(unit==="0") unit="";
      var qty=toNum(cell(row,cols.qty)), price=toNum(cell(row,cols.price));
      if(!code && !desc && qty===null){ stats.vacia++; continue; }
      if(/^(sub\s*total|total)\b/i.test(desc) && qty===null){ stats.subtotal++; continue; }
      if(isLetterChapter(code) && qty===null){ stats.titulo++; titles={1:desc}; cur={code:code,desc:desc,nivel:1};
        pushEst({codigo:code,nat:"Capitulo",ud:"",partida:desc,cantidad:""}); continue; }
      if(!isStructCode(code)){
        if(qty!==null && unit){                       // medición sin código en su fila
          stats.partida++;
          if(cur){                                    // partida compuesta: hereda código y partida de arriba
            out.push(rec({archivo:archivo,hoja:hoja,fila_origen:fila,
              capitulo:(cur.nivel>1?(titles[1]||""):""),
              subcapitulo:(cur.nivel>2?(titles[2]||""):""),
              seccion:(cur.nivel>3?(titles[3]||""):""),
              ruta:rutaDe(titles,cur.nivel),codigo:cur.code,partida:cur.desc,detalle:desc,
              unidad:unit,medicion:qty}));
            if(curEst && curEst.codigo===cur.code && curEst.nat!=="Capitulo"){   // la cabecera era una partida compuesta
              if(curEst.nat!=="Partida"){ curEst.nat="Partida"; curEst.ud=unit; }
              curEst.cantidad=(Number(curEst.cantidad)||0)+qty;                  // suma de sus parciais
            } else pushEst({codigo:cur.code,nat:"Partida",ud:unit,partida:cur.desc,cantidad:qty});
          } else {                                    // sin partida previa: se emite igual sin código
            out.push(rec({archivo:archivo,hoja:hoja,fila_origen:fila,
              capitulo:titles[1]||"",subcapitulo:titles[2]||"",seccion:titles[3]||"",
              ruta:rutaDe(titles,99),codigo:"",partida:desc,
              unidad:unit,medicion:qty}));
            pushEst({codigo:"",nat:"Partida",ud:unit,partida:desc,cantidad:qty});
          }
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
          ruta:rutaDe(titles,nivel),codigo:code,partida:desc,unidad:unit,medicion:qty}));
        cur={code:code,desc:desc,nivel:nivel};
        pushEst({codigo:code,nat:"Partida",ud:unit,partida:desc,cantidad:qty});
      } else {
        stats.titulo++; titles[nivel]=desc;
        Object.keys(titles).forEach(function(k){ if(+k>nivel) delete titles[k]; });
        cur={code:code,desc:desc,nivel:nivel};
        pushEst({codigo:code,nat:(nivel===1?"Capitulo":nivel===2?"Subcapitulo":"Sección"),ud:"",partida:desc,cantidad:""});
      }
    }
    return out;
  }
  function rutaDe(titles, nivel){
    return Object.keys(titles).map(Number).filter(function(k){return k<nivel && titles[k];})
           .sort(function(a,b){return a-b;}).map(function(k){return titles[k];}).join(" > ");
  }

  // ---- familia FORMATO ----
  function parseFormato(grid, cols, archivo, hoja, headerRow, capituloHoja, stats, est){
    var capitulo = capituloHoja, out=[], subcap="", partida=null, curEst=null;
    function pushEst(o){ if(est) est.push(o); curEst=o; return o; }
    if(headerRow>=0){ var d=txt(cell(grid[headerRow],cols.desc)); capitulo=d||capituloHoja; }
    pushEst({codigo:"",nat:"Capitulo",ud:"",partida:capitulo,cantidad:""});
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
        if(isCaps(desc) && qty===null){ subcap=desc; partida=null; stats.titulo++;
          pushEst({codigo:code,nat:"Subcapitulo",ud:"",partida:desc,cantidad:""}); continue; }
        partida={code:code,desc:desc}; stats.partida++;
        if(qty!==null) out.push(rec({archivo:archivo,hoja:hoja,fila_origen:fila,
          capitulo:capitulo,subcapitulo:subcap,ruta:ruta,codigo:code,partida:desc,
          unidad:unit,medicion:qty}));
        pushEst({codigo:code,nat:"Partida",ud:unit,partida:desc,cantidad:(qty!==null?qty:"")});
        continue;
      }
      if(qty!==null){
        stats.parcial++; var base=partida||{code:"",desc:""};
        out.push(rec({archivo:archivo,hoja:hoja,fila_origen:fila,capitulo:capitulo,
          subcapitulo:subcap,ruta:ruta,codigo:base.code,partida:base.desc,detalle:desc,
          unidad:unit,medicion:qty}));
        if(curEst && curEst.nat==="Partida"){                  // parcial -> suma a su partida
          if(curEst.cantidad===""||curEst.cantidad==null) curEst.cantidad=qty;
          else curEst.cantidad=(Number(curEst.cantidad)||0)+qty;
          if(!curEst.ud) curEst.ud=unit;
        } else pushEst({codigo:base.code,nat:"Partida",ud:unit,partida:base.desc,cantidad:qty});
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
    var a=[], c=inf.cols||{}, np=medRows.length, est=inf.estMedidas||0;
    var cols="descripción "+colLetra(c.desc)+" · unidad "+colLetra(c.unit)+" · cantidad "+colLetra(c.qty);

    if(np===0){
      if(est>=5) a.push("El original aparenta ~"+est+" mediciones pero no se extrajo ninguna: el mapeo de columnas no cuadra (asumí "+cols+"). Revísalo.");
      else a.push("Sin partidas extraídas y apenas "+est+" fila"+(est===1?"":"s")+" con pinta de medición: probablemente no es una hoja de medición. Si esperabas datos, revisa las columnas.");
      return a;  // sin partidas, el resto de avisos no aporta
    }

    // 1) Reconciliación: ¿hemos perdido mediciones respecto al original?
    if(est>=5 && np < est*0.7)
      a.push("Posible pérdida: el original aparenta ~"+est+" mediciones y solo se extrajeron "+np+". Revisa el mapeo (sobre todo la columna de cantidad).");
    // 2) Mapeo poco seguro: solo si además quedó incompleto (en extracciones completas no molesta)
    else if((inf.headerRow<0 || inf.headerScore<3) && est>0 && np<est)
      a.push("Mapeo poco seguro (cabecera "+(inf.headerRow<0?"no localizada":"poco clara")+"); asumí "+cols+". Si las partidas no cuadran, ajusta las columnas.");

    // 3) Unidades raras (proporcional: solo concluye si afecta a muchas filas)
    var us={}, nU=0; medRows.forEach(function(r){ var u=String(r.unidad||"").trim(); if(u&&unidadSospechosa(u)){us[u]=1;nU++;} });
    var ul=Object.keys(us);
    if(ul.length){
      if(nU>=np*0.5) a.push(nU+" de "+np+" partidas con unidad rara ("+ul.slice(0,5).join(", ")+") — puede que la columna "+colLetra(c.unit)+" no sea la de unidades.");
      else a.push("Unidades poco habituales en "+nU+" fila"+(nU>1?"s":"")+" ("+ul.slice(0,5).join(", ")+"); compruébalas si te chocan.");
    }

    // 4) Cantidad 0 (proporcional)
    var z=medRows.filter(function(r){return r.medicion===0;}).length;
    if(z>0){
      if(z>=np*0.5) a.push(z+" de "+np+" partidas con cantidad 0 — puede que la columna "+colLetra(c.qty)+" no sea la de cantidad.");
      else a.push(z+" partida"+(z>1?"s":"")+" con cantidad 0 (probablemente sin medir todavía).");
    }
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
                  filas:grid.length,excluida:false,motivo:"",
                  estMedidas:estimaMedidas(grid, headerRow>=0?headerRow+1:0)};
      var stats=nuevoStats(), res, medRows=[], notasRows=[], estRows=[];
      if(familia==="codigo") res=parseCodigo(grid,cols,archivo,hoja,headerRow,stats,estRows);
      else res=parseFormato(grid,cols,archivo,hoja,headerRow,hoja,stats,estRows);
      res.forEach(function(r){ if(Array.isArray(r)) notasRows.push({hoja:r[1],fila_origen:r[2],nota:r[3]}); else medRows.push(r); });
      info[hoja].stats=stats;
      info[hoja].nMed=medRows.length;        // partidas emitidas (lo que va a la salida)
      data[hoja]={medRows:medRows,notas:notasRows,claves:clavesDe(medRows),est:estRows};
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

    // 3) SEGUNDA CAPA: descartar hojas que objetivamente no tienen mediciones.
    //    Criterio (sin humano): 0 partidas extraídas Y el estimador independiente
    //    apenas ve filas con cantidad+unidad -> no es hoja de medición (resumen,
    //    índice, portada, notas). Si el estimador SÍ ve mediciones (est>=5), NO se
    //    descarta: es señal de pérdida y se mantiene marcada (lo gestiona avisosDe).
    nombres.forEach(function(h){
      var i=info[h]; if(i.excluida) return;
      // (a) ni una fila con cantidad+unidad real
      if(i.nMed===0 && i.estMedidas===0){
        i.excluida=true; i.noFuente=true; i.motivo="no es hoja de medición (ninguna fila con cantidad + unidad)"; return;
      }
      // (b) extrajo "partidas" pero el estimador no ve nada Y casi todo es cantidad 0
      //     -> resumen/subtotales mal interpretados (p. ej. listado de capítulos)
      if(i.estMedidas===0 && i.nMed>0){
        var ms=data[h].medRows, z=0; for(var k=0;k<ms.length;k++){ if(ms[k].medicion===0||ms[k].medicion===""||ms[k].medicion==null) z++; }
        if(z/ms.length>=0.9){ i.excluida=true; i.noFuente=true; i.motivo="no es hoja de medición (subtotales a 0, sin unidades reales)"; }
      }
    });

    // 4) salida desde las hojas no descartadas + avisos
    var medic=[], notas=[], estruct=[];
    nombres.forEach(function(h){
      var i=info[h];
      if(i.excluida){ i.avisos=[i.motivo]; return; }
      medic=medic.concat(data[h].medRows);
      notas=notas.concat(data[h].notas);
      estruct=estruct.concat(data[h].est);
      i.avisos=avisosDe(i, data[h].medRows);
    });
    return { mediciones:medic, notas:notas, estructura:estruct, info:info, CANON:CANON, COSTHEAD:COSTHEAD };
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
    var usados=archivos.filter(function(a){return !a.excluido;}).length;
    var medic=[], notas=[], hojas=[], estruct=[];
    items.forEach(function(it,i){
      if(archivos[i].excluido) return;
      medic=medic.concat(it.det.mediciones);
      notas=notas.concat(it.det.notas);
      if(it.det.estructura && it.det.estructura.length){
        if(usados>1) estruct.push({codigo:"",nat:"__archivo__",ud:"",partida:it.archivo,cantidad:""});
        estruct=estruct.concat(it.det.estructura);
      }
      Object.keys(it.det.info).forEach(function(h){
        var inf=it.det.info[h];
        hojas.push({archivo:it.archivo,hoja:h,nMed:inf.nMed||0,excluida:inf.excluida,
                    noFuente:!!inf.noFuente,motivo:inf.motivo,avisos:inf.avisos||[]});
      });
    });
    return { mediciones:medic, notas:notas, estructura:estruct, archivos:archivos, hojas:hojas, CANON:CANON, COSTHEAD:COSTHEAD };
  }

  var API={CANON:CANON,COSTHEAD:COSTHEAD,txt:txt,toNum:toNum,isStructCode:isStructCode,autoDetect:autoDetect,
           parseCodigo:parseCodigo,parseFormato:parseFormato,normalizar:normalizar,
           clavesDe:clavesDe,contencion:contencion,acumular:acumular};
  if(typeof module!=="undefined"&&module.exports) module.exports=API;
  else root.HopperCore=API;
})(typeof window!=="undefined"?window:this);

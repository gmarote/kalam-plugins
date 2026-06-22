/* Motor de normalización de MQT — Capa 1 (sin IA).
   Port de assets/extraer.py: reglas universales + familias código/formato.
   Funciona en navegador (window.HopperCore) y en Node (module.exports). */
(function (root) {
  "use strict";

  var CANON = ["archivo","hoja","fila_origen","division","capitulo","subcapitulo","seccion",
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
  function isLetterChapter(s){ return /^[A-Z]{1,4}\.?$/.test(s); }   // capítulo-letra: MAYÚSCULAS (A, B, ARQ, B.) — evita ruido tipo "ok"

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
    var met=[]; for(var c=0;c<N;c++) met[c]={num:0,numNZ:0,unit:0,textLen:0,textN:0,segMax:0,letras:0,letterCode:0,codeset:{},intset:{}};
    var seen=0;
    for(var r=start;r<grid.length && seen<400;r++){
      var rw=grid[r]; if(!rw) continue; var any=false;
      for(var k=0;k<N;k++){
        var s=txt(cell(rw,k)); if(!s) continue; any=true;
        // código con espacio interno ("A 1.1", "A 2"): se normaliza SOLO para los tests
        // de forma de código (no para número/texto), igual que hace parseCodigo. Si no,
        // la jerarquía real con espacios no se reconoce y gana una columna de códigos
        // sueltos peor (caso "códigos projeto" disperso a la derecha de la buena).
        var sc=(/^[A-Za-z]{0,4}\s+\d/.test(s) && s.length<=14) ? s.replace(/\s+/g,"") : s;
        if(/^\d+$/.test(s)) met[k].intset[s]=1;                 // enteros sueltos (posibles padres)
        if(/^[A-Za-z]{1,4}\d{0,3}$/.test(sc)) met[k].letterCode++;   // código corto tipo "A","A1","B2" (formato sin puntos)
        if(esCodigoPunteado(sc)){ met[k].codeset[sc]=1; var sg=sc.split(".").length; if(sg>met[k].segMax) met[k].segMax=sg;
          if(/^[A-Za-z]{1,4}[.\d]/.test(sc)) met[k].letras++; }
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

    // 3) asignar roles. Primero las ANCLAS fiables (descripción = texto más largo;
    //    unidad = tokens de unidad). Luego código y cantidad ANCLADOS por posición:
    //    en un MQT el código va a la IZQUIERDA de la descripción y la cantidad a la
    //    DERECHA de la unidad. Eso evita el fallo típico de que una columna de
    //    decimales (cantidades/dimensiones) se confunda con el código y se intercambien.
    var used={}, cols={}, lab=labelCols(grid, headerRow);
    function pick(role, scoreFn){
      var bi=-1,bv=0; for(var a=0;a<N;a++){ if(used[a]) continue; var v=scoreFn(met[a],a); if(v>bv){bv=v;bi=a;} }
      if(bi>=0){ cols[role]=bi; used[bi]=1; } return bi;
    }
    function pickPos(role, scoreFn, lo, hi){   // como pick pero restringido a columnas [lo..hi]
      var bi=-1,bv=0; for(var a=0;a<N;a++){ if(used[a]||a<lo||a>hi) continue; var v=scoreFn(met[a],a); if(v>bv){bv=v;bi=a;} }
      if(bi>=0){ cols[role]=bi; used[bi]=1; } return bi;
    }
    pick("desc", function(m){ return m.textN ? m.textLen/m.textN : 0; });      // texto más largo (ancla)
    pick("unit", function(m){ return m.unit; });                              // tokens de unidad (ancla)
    function codeScore(m,a){ if(esQtyLbl(lbl[a])||esPriceLbl(lbl[a])||esDim(lbl[a])) return 0;   // nunca es código si la cabecera dice cantidad/precio/dimensión
      if(m.esCodigo) return 1e6+m.nCodes;                                                          // jerarquía con puntos: máxima prioridad
      return (m.letterCode>=3) ? m.letterCode : 0; }                                               // si no, columna de códigos cortos tipo "A","A1","B2"
    function qtyScore(m,a){ if(esDim(lbl[a]) || esPriceLbl(lbl[a])) return 0; return m.numNZ + (esQtyLbl(lbl[a]) ? 1e7 : 0); }
    // la descripción parte la hoja: identificadores (código) a su izquierda;
    // medidas (unidad/cantidad/precio) a su derecha. Evita el cruce código↔cantidad.
    var dIdx=(cols.desc!=null?cols.desc:N);
    if(pickPos("code", codeScore, 0, dIdx-1)<0) pick("code", codeScore);       // código a la izquierda de la descripción (si no lo hay, sin restricción)
    if(pickPos("qty",  qtyScore, dIdx+1, N-1)<0) pick("qty", qtyScore);        // cantidad a la derecha de la descripción (si no la hay, sin restricción)
    pick("price",function(m,a){ return m.num + (esPriceLbl(lbl[a]) ? 1e7 : 0); });
    ["code","desc","unit","qty","price"].forEach(function(role,idx){
      if(cols[role]==null) cols[role] = (lab[role]!=null && !used[lab[role]] ? lab[role] : idx);
    });

    // columna-prefijo de código: jerarquía partida en 2 columnas (p. ej. Bloco en col 0
    // "A.", "A.1." y el ítem "1.1.1" en otra). Solo si a la izquierda del código hay
    // códigos con letra inicial y algún nivel ("A.1.") — patrón inequívoco.
    if(cols.code!=null){
      var pre=-1, preN=0, deep=0;
      for(var pc=0; pc<cols.code; pc++){
        if(used[pc]) continue;
        var cnt=0, dp=0;
        for(var rr=start; rr<grid.length && rr<start+400; rr++){
          var s2=txt(cell(grid[rr]||[],pc)).replace(/\s+/g,""); if(!s2) continue;
          if(/^[A-Za-z]{1,4}\.?(\d+\.?)*$/.test(s2)){ cnt++; if(/^[A-Za-z]{1,4}\.\d/.test(s2)) dp++; }
        }
        if(cnt>preN){ preN=cnt; pre=pc; deep=dp; }
      }
      if(pre>=0 && preN>=3 && deep>=2){ cols.codePrefix=pre; used[pre]=1; }
    }

    var familia = (cols.code!=null && met[cols.code] && met[cols.code].esCodigo) ? "codigo" : "formato";
    return { headerRow:headerRow, cols:cols, familia:familia, headerScore:bestScore };
  }

  // ---- familia CÓDIGO ----
  // ---- nivel superior al capítulo: edificio / bloque / fase (cuando la obra lo trae) ----
  function esDivision(s){ return /^\s*(bloco|bloque|edif[íi]cio|n[úu]cleo|corpo|torre)\b/i.test(String(s||"")); }
  function divActiva(titles){ return (titles[1] && esDivision(titles[1])) ? 1 : 0; }   // 1 si el nivel 1 es una división
  // columnas de jerarquía con nombre, desplazando uno si hay división por encima
  function jer(titles, nivel){
    var off=divActiva(titles);
    return { division:(off?(titles[1]||""):""),
             capitulo:(nivel>1+off?(titles[1+off]||""):""),
             subcapitulo:(nivel>2+off?(titles[2+off]||""):""),
             seccion:(nivel>3+off?(titles[3+off]||""):""),
             ruta:rutaDe(titles,nivel) };
  }
  function natDe(titles, nivel){   // etiqueta Nat para la hoja de costes (con desplazamiento)
    var off=divActiva(titles); if(nivel===1 && off) return "División";
    var n=nivel-off; return n<=1?"Capitulo":n===2?"Subcapitulo":"Sección";
  }
  // normaliza un código (quita espacios, puntos finales, puntos dobles) y combina prefijo+código
  function normCod(s){ return String(s||"").replace(/\s+/g,"").replace(/\.+$/,"").replace(/\.{2,}/g,"."); }
  function combinar(pref, code){ var a=normCod(pref), b=normCod(code); return b?(a?a+"."+b:b):a; }

  // primer segmento común a TODOS los códigos (p. ej. "A" si todo es "A.x"): un
  // nivel superior degenerado/constante sin cabecera propia. null si hay varios.
  function prefijoConstante(medRows){
    var seg=null, vis=false;
    for(var i=0;i<medRows.length;i++){ var c=txt(medRows[i].codigo); if(!c) continue;
      var s=c.split(".")[0]; if(seg===null){ seg=s; vis=true; } else if(s!==seg) return null; }
    return vis ? seg : null;
  }

  function parseCodigo(grid, cols, archivo, hoja, headerRow, stats, est, stripSeg, stripCero){
    var out=[], titles={}, cur=null, curEst=null, start = headerRow>=0 ? headerRow+1 : 0, letterCh=false;
    var unidadCtx="", unidadCtxNivel=0;   // unidad heredada del título padre (p.ej. "1.1 …(m2)" da unidad a sus hijos "1.1.1")
    function pushEst(o){ if(est) est.push(o); curEst=o; return o; }
    for(var i=start;i<grid.length;i++){
      var row=grid[i], fila=i+1;
      var code=txt(cell(row,cols.code)), desc=txt(cell(row,cols.desc)), unit=txt(cell(row,cols.unit));
      if(cols.codePrefix!=null){ var pref=txt(cell(row,cols.codePrefix)); if(pref) code=combinar(pref,code); }   // código en 2 columnas (prefijo Bloco)
      else if(/\s/.test(code)){ var _cs=normCod(code); if(isStructCode(_cs)) code=_cs; }   // código con espacios/punto final ("A 1.1.1.1", "ARQ 1.") -> normaliza
      if(stripSeg && code.indexOf(stripSeg+".")===0) code=code.slice(stripSeg.length+1);   // capa 3: quita el primer segmento constante degenerado
      if(stripCero){ var _z=code.replace(/(\.0+)+$/,""); if(_z && isStructCode(_z)) code=_z; }   // capa 3: convenio "1.0"=capítulo, "1.1.0"=subcapítulo -> quita el cero final
      if(unit==="0") unit="";
      var qty=toNum(cell(row,cols.qty)), price=toNum(cell(row,cols.price));
      if(!code && !desc && qty===null){ stats.vacia++; continue; }
      if(/^(sub\s*total|total)\b/i.test(desc) && qty===null){ stats.subtotal++; continue; }
      if(isLetterChapter(code) && !unit && !qty){   // capítulo-letra: «A»/«B» sin unidad ni cantidad (0 = título; hay MQT que ponen 0 en totales)
        if(desc && !(cur && cur.nivel===1 && cur.code===code)){   // solo la 1ª aparición con texto; las filas de continuación (celda combinada, mismo código sin texto) NO resetean el capítulo
          stats.titulo++; letterCh=true; titles={1:desc}; cur={code:code,desc:desc,nivel:1};
          pushEst({codigo:code,nat:natDe(titles,1),ud:"",partida:desc,cantidad:""});
        }
        continue; }
      if(!isStructCode(code)){
        if(qty!==null && unit){                       // medición sin código en su fila
          stats.partida++;
          if(cur){                                    // partida compuesta: hereda código y partida de arriba
            var Jc=jer(titles,cur.nivel);
            out.push(rec({archivo:archivo,hoja:hoja,fila_origen:fila,
              division:Jc.division,capitulo:Jc.capitulo,subcapitulo:Jc.subcapitulo,seccion:Jc.seccion,
              ruta:Jc.ruta,codigo:cur.code,partida:cur.desc,detalle:desc,
              unidad:unit,medicion:qty}));
            if(curEst && curEst.codigo===cur.code && curEst.nat!=="Capitulo"){   // la cabecera era una partida compuesta
              if(curEst.nat!=="Partida"){ curEst.nat="Partida"; curEst.ud=unit; }
              curEst.cantidad=(Number(curEst.cantidad)||0)+qty;                  // suma de sus parciais
            } else pushEst({codigo:cur.code,nat:"Partida",ud:unit,partida:cur.desc,cantidad:qty});
          } else {                                    // sin partida previa: se emite igual sin código
            var Jn=jer(titles,99);
            out.push(rec({archivo:archivo,hoja:hoja,fila_origen:fila,
              division:Jn.division,capitulo:Jn.capitulo,subcapitulo:Jn.subcapitulo,seccion:Jn.seccion,
              ruta:Jn.ruta,codigo:"",partida:desc,
              unidad:unit,medicion:qty}));
            pushEst({codigo:"",nat:"Partida",ud:unit,partida:desc,cantidad:qty});
          }
        } else { (desc?stats.nota++:stats.vacia++); if(desc) out.push(["__nota__",hoja,fila,desc]); }
        continue;
      }
      // profundidad: nº de segmentos punteados, +1 si la letra va pegada al primer
      // número ("A1" = A › A1) y hay un capítulo-letra activo. Así "A","A1","A1.1"
      // anidan en 3 niveles en vez de colapsar letra y primer número en uno.
      var _seg = code.split(".");
      var nivel = _seg.length + ((letterCh && /^[A-Za-z]+\d/.test(_seg[0])) ? 1 : 0);
      var unitEff = unit || (qty!==null ? unidadCtx : "");   // fila con código y cantidad pero sin unidad: hereda la del título padre
      if(qty!==null && unitEff){
        stats.partida++;
        var Jp=jer(titles,nivel);
        out.push(rec({archivo:archivo,hoja:hoja,fila_origen:fila,
          division:Jp.division,capitulo:Jp.capitulo,subcapitulo:Jp.subcapitulo,seccion:Jp.seccion,
          ruta:Jp.ruta,codigo:code,partida:desc,unidad:unitEff,medicion:qty}));
        cur={code:code,desc:desc,nivel:nivel};
        pushEst({codigo:code,nat:"Partida",ud:unitEff,partida:desc,cantidad:qty});
      } else if(desc && cur && cur.code===code){   // mismo código que el nodo vigente y sin medición: nota/parcial de continuación (p.ej. «A2» repetido con una observación). NO es un subtítulo nuevo: no toca la jerarquía.
        stats.nota++; out.push(["__nota__",hoja,fila,desc]);
      } else if(desc){
        if(nivel<=unidadCtxNivel){ unidadCtx=""; unidadCtxNivel=0; }   // salimos del subárbol que declaró la unidad
        if(unit){ unidadCtx=unit; unidadCtxNivel=nivel; }              // este título declara unidad para sus hijos
        stats.titulo++; titles[nivel]=desc;
        Object.keys(titles).forEach(function(k){ if(+k>nivel) delete titles[k]; });
        cur={code:code,desc:desc,nivel:nivel};
        pushEst({codigo:code,nat:natDe(titles,nivel),ud:"",partida:desc,cantidad:""});
      } else { stats.vacia++;   // fila de continuación: mismo código sin texto (celda combinada). NO resetea la jerarquía ni emite título vacío.
      }
    }
    return out;
  }
  function rutaDe(titles, nivel){
    return Object.keys(titles).map(Number).filter(function(k){return k<nivel && titles[k];})
           .sort(function(a,b){return a-b;}).map(function(k){return titles[k];}).join(" > ");
  }

  // ---- familia FORMATO ----
  // nombre de hoja sin valor de capítulo: etiqueta de documento (MQT/MTQ/Mapa de
  // Quantidades/Folha/Resumo…), no una disciplina. En esas hojas el capítulo lo dan
  // los títulos internos, no el nombre de la hoja. Un nombre de disciplina real
  // ("ARQUITECTURA", "C - ÁGUAS", "ELEVADOR") NO entra aquí: sigue siendo capítulo.
  function esHojaGenerica(s){ return /^\s*(mqt|mtq|mapa\s*de\s*(quantidades|trabalhos)|medi[cç][õo]es|or[cç]amento|folha|sheet|hoja|planilha|resumo)\b/i.test(String(s||"")); }
  function parseFormato(grid, cols, archivo, hoja, headerRow, capituloHoja, stats, est){
    var generica = esHojaGenerica(hoja), capitulo = capituloHoja, out=[], subcap="", partida=null, curEst=null;
    function pushEst(o){ if(est) est.push(o); curEst=o; return o; }
    if(headerRow>=0){ var d=txt(cell(grid[headerRow],cols.desc)); if(d && !roleOf(d)) capitulo=d; }   // usa el texto del encabezado como capítulo solo si NO es la etiqueta de columna ("Designação")
    if(!generica) pushEst({codigo:"",nat:"Capitulo",ud:"",partida:capitulo,cantidad:""});   // hoja genérica: el capítulo lo ponen los títulos internos, no el nombre de hoja
    var start = headerRow>=0?headerRow+1:0;
    for(var i=start;i<grid.length;i++){
      var row=grid[i], fila=i+1;
      var code=txt(cell(row,cols.code)), desc=txt(cell(row,cols.desc)), unit=txt(cell(row,cols.unit));
      if(cols.codePrefix!=null){ var pref=txt(cell(row,cols.codePrefix)); if(pref) code=combinar(pref,code); }   // código en 2 columnas (prefijo Bloco)
      else if(/\s/.test(code)){ var _cs=normCod(code); if(isStructCode(_cs)) code=_cs; }   // código con espacios/punto final ("A 1.1.1.1", "ARQ 1.") -> normaliza
      if(unit==="0") unit="";
      var qty=toNum(cell(row,cols.qty)), price=toNum(cell(row,cols.price));
      if(desc==="DESCRITIVO") continue;
      if(!code && !desc && qty===null){ stats.vacia++; continue; }
      if(/^total\b/i.test(desc) && qty===null){ stats.subtotal++; continue; }
      var ruta=[capitulo,subcap].filter(Boolean).join(" > ");
      if(code){
        if(isCaps(desc) && qty===null){ stats.titulo++; partida=null;
          if(generica){ capitulo=desc; subcap="";                          // hoja genérica: el título en mayúsculas ES el capítulo (sube un nivel; el nombre de hoja no cuenta)
            pushEst({codigo:code,nat:"Capitulo",ud:"",partida:desc,cantidad:""}); }
          else { subcap=desc;                                              // hoja con nombre de disciplina: el título es subcapítulo bajo ella
            pushEst({codigo:code,nat:"Subcapitulo",ud:"",partida:desc,cantidad:""}); }
          continue; }
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

  // ---- CAPA 2: auto-auditoría. Con la tabla YA montada, busca incoherencias
  //      internas que una pasada hacia delante no puede ver. No repara: señala
  //      y devuelve una confianza 0..1 por hoja. ----
  function auditar(medRows){
    var n=medRows.length; if(!n) return {avisos:[], confianza:1};
    var a=[], pen=0;
    // A) jerarquía rota: capítulo vacío PERO subcapítulo/sección con contenido es
    //    imposible "bien" -> se perdió la cabecera de capítulo. (Distinto del caso
    //    benigno en que TODO el nivel está vacío: ahí el capítulo es la propia hoja.)
    var rota=0, sinCap=0;
    for(var i=0;i<n;i++){ var capV=!txt(medRows[i].capitulo);
      if(capV){ sinCap++; if(txt(medRows[i].subcapitulo)||txt(medRows[i].seccion)) rota++; } }
    if(rota>0){
      a.push(rota+" de "+n+" partidas con subcapítulo/sección pero SIN capítulo: se perdió la cabecera de capítulo.");
      pen=Math.max(pen, Math.min(0.55, 0.2+(rota/n)*0.5));
    } else if(sinCap===n){
      a.push("Capítulo sin asignar en toda la hoja (probablemente el capítulo es la propia hoja).");
      pen=Math.max(pen,0.1);   // benigno: apenas penaliza
    }
    // B) misma descripción de partida repetida con el texto real en «detalle»
    //    (síntoma de columna de descripción mal asignada o herencia errónea)
    var freq={}, maxRep=0, maxKey="";
    for(var j=0;j<n;j++){ var k=txt(medRows[j].partida); if(!k) continue; freq[k]=(freq[k]||0)+1; if(freq[k]>maxRep){ maxRep=freq[k]; maxKey=k; } }
    if(maxRep>=4 && maxRep/n>=0.3){
      var conDet=0; for(var p=0;p<n;p++) if(txt(medRows[p].partida)===maxKey && txt(medRows[p].detalle)) conDet++;
      if(conDet>=Math.ceil(maxRep*0.7)){
        a.push("La descripción «"+maxKey.slice(0,38)+(maxKey.length>38?"…":"")+"» se repite en "+maxRep+" partidas con el texto real en «detalle»: revisa si es un título colado como descripción.");
        pen=Math.max(pen,0.45);
      }
    }
    // C) muchas partidas sin código (señal leve: puede ser normal)
    var sinCod=0; for(var q=0;q<n;q++) if(!txt(medRows[q].codigo)) sinCod++;
    if(sinCod>=8 && sinCod/n>=0.6){ a.push(sinCod+" de "+n+" partidas sin código (códigos no reconocidos o ausentes)."); pen=Math.max(pen,0.15); }
    return {avisos:a, confianza:Math.round((1-pen)*100)/100, rota:rota};
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
      function correr(o){
        o=o||{}; var st=nuevoStats(), est=[], med=[], not=[];
        var r=(familia==="codigo") ? parseCodigo(grid,cols,archivo,hoja,headerRow,st,est,o.seg,o.cero)
                                   : parseFormato(grid,cols,archivo,hoja,headerRow,hoja,st,est);
        r.forEach(function(x){ if(Array.isArray(x)) not.push({hoja:x[1],fila_origen:x[2],nota:x[3]}); else med.push(x); });
        return {stats:st,est:est,med:med,not:not};
      }
      var p0=correr(null), stats=p0.stats, medRows=p0.med, notasRows=p0.not, estRows=p0.est;
      // CAPA 3: la señal de "jerarquía rota" (capa 2) dispara la corrección. Se
      // prueban varias recetas según la causa y se queda la que MÁS sube la
      // confianza (y solo si la sube). Nunca empeora.
      if(familia==="codigo"){
        var aud0=auditar(medRows);
        if(aud0.rota>0){
          var cp=prefijoConstante(medRows), hyps=[];
          if(cp) hyps.push({o:{seg:cp}, msg:"nivel constante «"+cp+"» sin cabecera: eliminado (la jerarquía sube un nivel)"});
          hyps.push({o:{cero:1}, msg:"códigos con «.0» de cabecera (1.0 = capítulo): cero final normalizado"});
          var mejorConf=aud0.confianza, mejor=null;
          hyps.forEach(function(hy){ var p=correr(hy.o); var cf=auditar(p.med).confianza; if(cf>mejorConf){ mejorConf=cf; mejor={p:p,msg:hy.msg}; } });
          if(mejor){ stats=mejor.p.stats; medRows=mejor.p.med; notasRows=mejor.p.not; estRows=mejor.p.est; info[hoja].capa3=mejor.msg; }
        }
      }
      // CAPA 3 (regla universal): por definición toda partida tiene capítulo. Si
      // tras las recetas aún queda capítulo vacío PERO hay ruta (existen títulos
      // por encima), se compacta: el título más alto que exista pasa a capítulo,
      // el siguiente a subcapítulo, etc. (si el más alto es una división, respeta).
      var comp=0;
      medRows.forEach(function(r){
        if(!txt(r.capitulo) && txt(r.ruta)){
          var parts=String(r.ruta).split(" > ").filter(Boolean);
          var off=(parts[0]&&esDivision(parts[0])&&parts.length>1)?1:0;   // si la división es el único nivel, pasa a capítulo
          if(off) r.division=parts[0];
          r.capitulo=parts[off]||""; r.subcapitulo=parts[off+1]||""; r.seccion=parts[off+2]||"";
          if(r.capitulo) comp++;
        }
      });
      if(comp) info[hoja].compactado=comp;
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
      // (b) extrajo "partidas" pero el estimador no ve NINGUNA medición real
      //     (ni una fila con número+unidad) -> resumen/lista de importes mal
      //     interpretado: o casi todo es cantidad 0, o no hay unidades en absoluto
      //     (un resumen lista disciplinas con su importe, sin unidad).
      if(i.estMedidas===0 && i.nMed>0){
        var ms=data[h].medRows, z=0, sinU=0;
        for(var k=0;k<ms.length;k++){ var mm=ms[k].medicion; if(mm===0||mm===""||mm==null) z++; if(!txt(ms[k].unidad)) sinU++; }
        if(z/ms.length>=0.9){ i.excluida=true; i.noFuente=true; i.motivo="no es hoja de medición (subtotales a 0, sin unidades reales)"; }
        else if(sinU/ms.length>=0.95){ i.excluida=true; i.noFuente=true; i.motivo="no es hoja de medición (sin unidades; parece un resumen/lista de importes)"; }
      }
    });

    // 4) salida desde las hojas no descartadas + avisos
    var medic=[], notas=[], estruct=[];
    nombres.forEach(function(h){
      var i=info[h];
      if(i.excluida){ i.avisos=[i.motivo]; i.confianza=1; return; }
      medic=medic.concat(data[h].medRows);
      notas=notas.concat(data[h].notas);
      estruct=estruct.concat(data[h].est);
      var aud=auditar(data[h].medRows);                 // capa 2: auto-auditoría
      i.avisos=avisosDe(i, data[h].medRows).concat(aud.avisos);
      i.confianza=aud.confianza;
      if(i.compactado){   // jerarquía incompleta en origen: capítulo inferido (compactado). Se marca, no se cae.
        i.avisos.push(i.compactado+" partida"+(i.compactado>1?"s":"")+" con capítulo inferido (faltaba el nivel superior en origen): el título más alto presente pasó a capítulo. Revísalo.");
        i.confianza=Math.min(i.confianza, 0.9);
      }
    });
    // ¿es un MQT del sector? Señal estructural robusta: la mejor hoja debe tener
    // un mínimo de filas con número + unidad real (estMedidas). Un Excel ajeno
    // (inventario, listado…) no llega. No bloquea: la UI lo usa para avisar y no
    // fingir fiabilidad. (Calibrado: no-MQT <=3, MQT reales >=23.)
    var maxEst=0; nombres.forEach(function(h){ var em=info[h].estMedidas||0; if(em>maxEst) maxEst=em; });
    return { mediciones:medic, notas:notas, estructura:estruct, info:info, CANON:CANON, COSTHEAD:COSTHEAD,
             esMQT:(maxEst>=8), mqtScore:maxEst };
  }

  // ---- acumular varios ficheros en una sola salida (dedup a nivel de fichero) ----
  // items: [{archivo, det}]  (det = resultado de normalizar). Un fichero se descarta
  // si sus ítems están contenidos (>=80%) en otro mayor (p. ej. cargar dos veces el
  // mismo). Especialidades distintas (Ferragial ARQ vs ESP) NO se solapan -> se suman.
  function acumular(items){
    var claves=items.map(function(it){ return clavesDe(it.det.mediciones); });
    var n=claves.map(function(k){ return Object.keys(k).length; });
    var archivos=items.map(function(it){ return {nombre:it.archivo, nMed:it.det.mediciones.length, excluido:false, motivo:"", esMQT:(it.det.esMQT!==false)}; });
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
                    noFuente:!!inf.noFuente,motivo:inf.motivo,avisos:inf.avisos||[],
                    confianza:(inf.confianza==null?1:inf.confianza),capa3:inf.capa3||""});
      });
    });
    var algunMQT=archivos.some(function(a){return !a.excluido && a.esMQT;});
    return { mediciones:medic, notas:notas, estructura:estruct, archivos:archivos, hojas:hojas,
             esMQT:algunMQT, CANON:CANON, COSTHEAD:COSTHEAD };
  }

  var API={CANON:CANON,COSTHEAD:COSTHEAD,txt:txt,toNum:toNum,isStructCode:isStructCode,autoDetect:autoDetect,
           parseCodigo:parseCodigo,parseFormato:parseFormato,normalizar:normalizar,
           clavesDe:clavesDe,contencion:contencion,acumular:acumular};
  if(typeof module!=="undefined"&&module.exports) module.exports=API;
  else root.HopperCore=API;
})(typeof window!=="undefined"?window:this);

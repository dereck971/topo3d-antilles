// ─── IIFE MODULE — prevents global state pollution ───
;(function(window, document) {
'use strict';

// ─── STATE ───
var selParc=null,popup=null,offer='complet',rotating=false,rotAnim=null;
let drawMode=false,drawStart=null,drawRect=null,drawnArea=null;

// ─── POINTS OF INTEREST ───
const POI={
    s:{center:[-61.6642,16.0445],zoom:13.5,pitch:70,bearing:-30},
    p:{center:[-61.5353,16.2411],zoom:13,pitch:55,bearing:20},
    sa:{center:[-61.6175,15.8595],zoom:12.5,pitch:60,bearing:-45},
    o:{center:[-61.55,16.18],zoom:10.5,pitch:50,bearing:-10},
    fdf:{center:[-61.0588,14.6160],zoom:13.5,pitch:55,bearing:20},
    dmt:{center:[-61.06,14.66],zoom:13,pitch:55,bearing:-30},
    plan:{pitch:0,bearing:0},
    view3d:{pitch:55,bearing:-20}
};

// ─── STYLES ───
const STYLES={
    topo:{version:8,sources:{'osm':{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OSM'},'terrarium':{type:'raster-dem',tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],encoding:'terrarium',tileSize:256,maxzoom:15}},layers:[{id:'base',type:'raster',source:'osm'}],terrain:{source:'terrarium',exaggeration:1.5}},
    satellite:{version:8,sources:{'sat':{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,attribution:'© Esri'},'terrarium':{type:'raster-dem',tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],encoding:'terrarium',tileSize:256,maxzoom:15}},layers:[{id:'base',type:'raster',source:'sat'}],terrain:{source:'terrarium',exaggeration:1.5}},
    'topo-fr':{version:8,sources:{'planign':{type:'raster',tiles:['https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png&STYLE=normal'],tileSize:256,attribution:'© IGN'},'terrarium':{type:'raster-dem',tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],encoding:'terrarium',tileSize:256,maxzoom:15}},layers:[{id:'base',type:'raster',source:'planign'}],terrain:{source:'terrarium',exaggeration:1.5}}
};

let currentStyle='topo';
let currentIle='guadeloupe';

// ─── MAP ───
// Detect island from URL param
const urlParams=new URLSearchParams(window.location.search);
const ile=urlParams.get('ile')||'guadeloupe';
currentIle=ile;
const ileConfig={
    guadeloupe:{center:[-61.55,16.18],zoom:10.5,pitch:50,bearing:-10},
    martinique:{center:[-61.02,14.64],zoom:11,pitch:50,bearing:-10}
};
const startView=ileConfig[ile]||ileConfig.guadeloupe;

const map=new maplibregl.Map({container:'map',style:STYLES.topo,center:startView.center,zoom:startView.zoom,pitch:startView.pitch,bearing:startView.bearing,maxPitch:85,antialias:true});
map.addControl(new maplibregl.NavigationControl({visualizePitch:true}));
map.addControl(new maplibregl.ScaleControl({maxWidth:150}),'bottom-right');
map.addControl(new maplibregl.FullscreenControl());

// ─── LAYER STATE ───
const layerState={'cadastre-wms':true,'buildings-3d':false,'ortho-ign':false,'hillshade':false,'contours':false,'hydro':false,'zones-risk':false,'plu-zonage':false,'plu-prescrip':false,'natura2000':false,'znieff1':false,'littoral':false,'monuments-h':false};

map.on('load',()=>{
    addSky();
    addParcelleSource();
    addCustomLayers();
    initAddrAutocomplete();
    updateCommuneDropdown(ile);
});

function addSky(){
    if(!map.getLayer('sky'))map.addLayer({id:'sky',type:'sky',paint:{'sky-type':'atmosphere','sky-atmosphere-sun':[210,40],'sky-atmosphere-sun-intensity':5}});
}

function addParcelleSource(){
    if(!map.getSource('parcelle')){
        map.addSource('parcelle',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
        map.addLayer({id:'parc-fill',type:'fill',source:'parcelle',paint:{'fill-color':'#00d4aa','fill-opacity':0.2}});
        map.addLayer({id:'parc-line',type:'line',source:'parcelle',paint:{'line-color':'#00d4aa','line-width':3}});
        map.addLayer({id:'parc-dash',type:'line',source:'parcelle',paint:{'line-color':'#ffffff','line-width':1,'line-dasharray':[4,3],'line-opacity':0.4}});
    }
    if(!map.getSource('pin')){
        map.addSource('pin',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
        map.addLayer({id:'pin-c',type:'circle',source:'pin',paint:{'circle-radius':7,'circle-color':'#ff4444','circle-stroke-width':2,'circle-stroke-color':'#fff'}});
    }
    if(!map.getSource('draw-rect')){
        map.addSource('draw-rect',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
        map.addLayer({id:'draw-rect-fill',type:'fill',source:'draw-rect',paint:{'fill-color':'#ffdd00','fill-opacity':0.2}});
        map.addLayer({id:'draw-rect-line',type:'line',source:'draw-rect',paint:{'line-color':'#ffdd00','line-width':2}});
    }
}

function addCustomLayers(){
    // Cadastre WMS IGN
    if(!map.getSource('cadastre-src')){
        map.addSource('cadastre-src',{type:'raster',tiles:['https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true&STYLES='],tileSize:256});
        map.addLayer({id:'cadastre-wms',type:'raster',source:'cadastre-src',paint:{'raster-opacity':0.6}});
    }

    // Orthophoto IGN
    if(!map.getSource('ortho-src')){
        map.addSource('ortho-src',{type:'raster',tiles:['https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg&STYLE=normal'],tileSize:256,maxzoom:19});
        map.addLayer({id:'ortho-ign',type:'raster',source:'ortho-src',paint:{'raster-opacity':0.85},layout:{visibility:'none'}});
    }

    // Hillshade
    if(!map.getSource('hs-src')){
        map.addSource('hs-src',{type:'raster-dem',tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],encoding:'terrarium',tileSize:256});
        map.addLayer({id:'hillshade',type:'hillshade',source:'hs-src',paint:{'hillshade-shadow-color':'#000','hillshade-illumination-direction':210,'hillshade-exaggeration':0.5},layout:{visibility:'none'}});
    }

    // Courbes de niveau IGN
    if(!map.getSource('contours-src')){
        map.addSource('contours-src',{type:'raster',tiles:['https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ELEVATION.CONTOUR.LINE&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true&STYLES='],tileSize:256});
        map.addLayer({id:'contours',type:'raster',source:'contours-src',paint:{'raster-opacity':0.7},layout:{visibility:'none'}});
    }

    // Hydrographie IGN
    if(!map.getSource('hydro-src')){
        map.addSource('hydro-src',{type:'raster',tiles:['https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=HYDROGRAPHY.HYDROGRAPHY&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true&STYLES='],tileSize:256});
        map.addLayer({id:'hydro',type:'raster',source:'hydro-src',paint:{'raster-opacity':0.6},layout:{visibility:'none'}});
    }

    // Zones de risques
    if(!map.getSource('risk-src')){
        map.addSource('risk-src',{type:'raster',tiles:['https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=GEOGRAPHICALGRIDSYSTEMS.1702_PPR&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true&STYLES='],tileSize:256});
        map.addLayer({id:'zones-risk',type:'raster',source:'risk-src',paint:{'raster-opacity':0.5},layout:{visibility:'none'}});
    }

    // ─── RÉGLEMENTATION ───

    // PLU Zonage (Géoportail de l'Urbanisme)
    if(!map.getSource('plu-zonage-src')){
        map.addSource('plu-zonage-src',{type:'raster',tiles:['https://data.geopf.fr/wms-v/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=zone_urba&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true&STYLES='],tileSize:256});
        map.addLayer({id:'plu-zonage',type:'raster',source:'plu-zonage-src',paint:{'raster-opacity':0.55},layout:{visibility:'none'}});
    }

    // PLU Prescriptions surfaciques
    if(!map.getSource('plu-prescrip-src')){
        map.addSource('plu-prescrip-src',{type:'raster',tiles:['https://data.geopf.fr/wms-v/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=prescription_surf&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true&STYLES='],tileSize:256});
        map.addLayer({id:'plu-prescrip',type:'raster',source:'plu-prescrip-src',paint:{'raster-opacity':0.5},layout:{visibility:'none'}});
    }

    // Natura 2000 — Directive Habitats (SIC)
    if(!map.getSource('natura2000-src')){
        map.addSource('natura2000-src',{type:'raster',tiles:['https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=PROTECTEDAREAS.SIC&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true&STYLES='],tileSize:256});
        map.addLayer({id:'natura2000',type:'raster',source:'natura2000-src',paint:{'raster-opacity':0.5},layout:{visibility:'none'}});
    }

    // ZNIEFF type I
    if(!map.getSource('znieff1-src')){
        map.addSource('znieff1-src',{type:'raster',tiles:['https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=PROTECTEDAREAS.ZNIEFF1&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true&STYLES='],tileSize:256});
        map.addLayer({id:'znieff1',type:'raster',source:'znieff1-src',paint:{'raster-opacity':0.45},layout:{visibility:'none'}});
    }

    // Conservatoire du Littoral
    if(!map.getSource('littoral-src')){
        map.addSource('littoral-src',{type:'raster',tiles:['https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=PROTECTEDSITES.MNHN.CONSERVATOIRE_LITTORAL&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true&STYLES='],tileSize:256});
        map.addLayer({id:'littoral',type:'raster',source:'littoral-src',paint:{'raster-opacity':0.5},layout:{visibility:'none'}});
    }

    // Monuments historiques — périmètres de protection
    if(!map.getSource('monuments-h-src')){
        map.addSource('monuments-h-src',{type:'raster',tiles:['https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=PROTECTEDSITES.MNHN.MONUMENTS_HISTORIQUES.PERIMETRES&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true&STYLES='],tileSize:256});
        map.addLayer({id:'monuments-h',type:'raster',source:'monuments-h-src',paint:{'raster-opacity':0.45},layout:{visibility:'none'}});
    }

    // Bâtiments 3D — tuiles vectorielles OSM (OpenFreeMap) avec extrusion 3D
    if(!map.getSource('buildings-src')){
        map.addSource('buildings-src',{
            type:'vector',
            url:'https://tiles.openfreemap.org/planet'
        });
        map.addLayer({
            id:'buildings-3d',
            type:'fill-extrusion',
            source:'buildings-src',
            'source-layer':'building',
            minzoom:14,
            layout:{visibility:'none'},
            paint:{
                'fill-extrusion-color':[
                    'interpolate',['linear'],['coalesce',['get','render_height'],6],
                    0,'#b8d4e3',
                    8,'#90b4ce',
                    15,'#6894b9',
                    30,'#4a7a9e'
                ],
                'fill-extrusion-height':['coalesce',['get','render_height'],['get','height'],6],
                'fill-extrusion-base':['coalesce',['get','render_min_height'],0],
                'fill-extrusion-opacity':0.75
            }
        });
    }
}

// ─── LAYER TOGGLE ───
function toggleLayer(el,layerId){
    el.classList.toggle('on');
    const on=el.classList.contains('on');
    layerState[layerId]=on;
    if(map.getLayer(layerId)){
        map.setLayoutProperty(layerId,
            'visibility',on?'visible':'none');
    }
}

// ─── STYLE SWITCH ───
function setStyle(name,btn){
    currentStyle=name;
    const ex=parseFloat(document.getElementById('exR').value);
    const s=JSON.parse(JSON.stringify(STYLES[name]));
    s.terrain.exaggeration=ex;
    const c=map.getCenter(),z=map.getZoom(),p=map.getPitch(),b=map.getBearing();

    document.querySelectorAll('.style-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');

    map.setStyle(s);
    map.once('style.load',()=>{
        addSky();
        addParcelleSource();
        addCustomLayers();
        // Restore layer visibility
        Object.entries(layerState).forEach(([id,on])=>{
            if(map.getLayer(id)) map.setLayoutProperty(id,'visibility',on?'visible':'none');
        });
        // Restore parcelle data
        if(selParc) map.getSource('parcelle')?.setData({type:'FeatureCollection',features:[selParc]});
    });
}

// ─── CAMERA CONTROLS ───
document.getElementById('exR').oninput=e=>{const v=parseFloat(e.target.value);document.getElementById('exV').textContent=v.toFixed(1)+'×';map.setTerrain({source:'terrarium',exaggeration:v})};
document.getElementById('piR').oninput=e=>{const v=parseInt(e.target.value);document.getElementById('piV').textContent=v+'°';map.easeTo({pitch:v,duration:200})};
document.getElementById('liR').oninput=e=>{const v=parseInt(e.target.value);document.getElementById('liV').textContent=v+'°';if(map.getLayer('sky'))map.setPaintProperty('sky','sky-atmosphere-sun',[v,40]);if(map.getLayer('hillshade'))map.setPaintProperty('hillshade','hillshade-illumination-direction',v)};

function go(k){if(POI[k]){const p=POI[k],opts={duration:2500,essential:true};if(p.center&&p.zoom)map.flyTo({...p,...opts});else map.easeTo({...p,...opts})}}

function goToPlanView(){map.easeTo({pitch:0,bearing:0,duration:800})}
function go3DView(){map.easeTo({pitch:55,bearing:-20,duration:800})}

// ─── ILE SWITCH ───
function switchIle(name){
    currentIle=name;
    const cfg=ileConfig[name]||ileConfig.guadeloupe;
    map.flyTo({center:cfg.center,zoom:cfg.zoom,pitch:cfg.pitch,bearing:cfg.bearing,duration:2500,essential:true});
    document.getElementById('ile-label').textContent=name==='martinique'?'Martinique':'Guadeloupe';
    document.getElementById('btn-gp').classList.toggle('active',name==='guadeloupe');
    document.getElementById('btn-mq').classList.toggle('active',name==='martinique');
    // Update URL without reload
    const url=new URL(window.location);
    url.searchParams.set('ile',name);
    history.replaceState(null,'',url);
    updateCommuneDropdown(name);
}

function updateCommuneDropdown(ile){
    const sel=document.getElementById('cad-com');
    if(!sel)return;
    sel.innerHTML='<option value="">— Choisir —</option>';

    const communes=ile==='martinique'?{
        '97201':'L\'Ajoupa-Bouillon','97202':'Basse-Pointe','97203':'Bellefontaine','97204':'Case-Pilote','97205':'Le Carbet',
        '97206':'Le Diamant','97207':'Ducos','97208':'Fonds-Saint-Denis','97209':'Fort-de-France','97210':'Le François',
        '97211':'Grand\'Rivière','97212':'Gros-Morne','97213':'Le Lamentin','97214':'Le Lorrain','97215':'Macouba',
        '97216':'Le Marigot','97217':'Le Marin','97218':'Le Morne-Rouge','97219':'Le Morne-Vert','97220':'Le Prêcheur',
        '97221':'Rivière-Pilote','97222':'Rivière-Salée','97223':'Le Robert','97224':'Saint-Esprit','97225':'Saint-Joseph',
        '97226':'Saint-Pierre','97227':'Sainte-Anne','97228':'Sainte-Luce','97229':'Sainte-Marie','97230':'Schœlcher',
        '97231':'La Trinité','97232':'Les Trois-Îlets','97233':'Le Vauclin'
    }:{
        '97101':'Les Abymes','97102':'Anse-Bertrand','97103':'Baie-Mahault','97104':'Baillif','97105':'Basse-Terre',
        '97106':'Bouillante','97107':'Capesterre-Belle-Eau','97108':'Capesterre-de-Marie-Galante','97109':'Deshaies',
        '97110':'Gourbeyre','97111':'Goyave','97112':'Grand-Bourg','97113':'Lamentin','97114':'Le Gosier',
        '97115':'Le Moule','97116':'Morne-à-l\'Eau','97117':'Petit-Bourg','97118':'Petit-Canal',
        '97120':'Pointe-à-Pitre','97121':'Pointe-Noire','97122':'Port-Louis','97123':'Saint-Claude',
        '97124':'Saint-François','97125':'Saint-Louis','97126':'Sainte-Anne','97127':'Sainte-Rose',
        '97128':'Terre-de-Bas','97129':'Terre-de-Haut','97130':'Trois-Rivières','97131':'Vieux-Fort',
        '97132':'Vieux-Habitants'
    };

    Object.entries(communes).forEach(([code,name])=>{
        const opt=document.createElement('option');
        opt.value=code;
        opt.textContent=`${code} ${name}`;
        sel.appendChild(opt);
    });
}

// Init active button (without flyTo since map is already centered)
document.getElementById('ile-label').textContent=ile==='martinique'?'Martinique':'Guadeloupe';
document.getElementById('btn-gp').classList.toggle('active',ile==='guadeloupe');
document.getElementById('btn-mq').classList.toggle('active',ile==='martinique');

// ─── AUTO ROTATE ───
function toggleRotate(){
    rotating=!rotating;
    document.getElementById('rotateBtn').classList.toggle('active',rotating);
    if(rotating) rotateStep();
    else if(rotAnim){cancelAnimationFrame(rotAnim);rotAnim=null}
}
function rotateStep(){
    if(!rotating)return;
    map.rotateTo(map.getBearing()+0.3,{duration:0});
    rotAnim=requestAnimationFrame(rotateStep);
}
map.on('mousedown',()=>{if(rotating){rotating=false;document.getElementById('rotateBtn').classList.remove('active');if(rotAnim)cancelAnimationFrame(rotAnim)}});

// ─── SIDEBAR ───
function toggleSidebar(){
    const sb=document.getElementById('sidebar');
    sb.classList.toggle('collapsed');
    document.getElementById('sbToggle').textContent=sb.classList.contains('collapsed')?'▶':'◀';
    setTimeout(()=>map.resize(),400);
}

// ─── TABS ───
function stab(id){
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${id}"]`).classList.add('active');
    document.getElementById(`tab-${id}`).classList.add('active');
}

// ─── MOUSE ───
map.on('mousemove',e=>{
    const{lng,lat}=e.lngLat;
    document.getElementById('mc').textContent=`${lat.toFixed(5)}°N, ${Math.abs(lng).toFixed(5)}°W`;
    const h=map.queryTerrainElevation(e.lngLat);
    document.getElementById('me').textContent=h!=null?`${Math.round(h)} m`:'—';
});

// ─── CLICK MAP ───
map.on('click',async e=>{
    if(drawMode){handleDrawClick(e);return}
    const{lng,lat}=e.lngLat;
    showLd('Recherche de la parcelle...');
    document.getElementById('mapHint').classList.add('hidden');
    map.getSource('pin')?.setData({type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[lng,lat]}}]});
    try{
        const r=await fetch('https://apicarto.ign.fr/api/cadastre/parcelle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({geom:{type:'Point',coordinates:[lng,lat]}})});
        const d=await r.json();
        if(d.features?.length>0) showParc(d.features[0]);
        else{hideLd();alert('Aucune parcelle trouvée ici.')}
    }catch(err){hideLd();alert('Erreur API cadastre.');console.error(err)}
});

map.on('mousemove',e=>{
    if(drawMode&&drawStart){
        const{lng,lat}=e.lngLat;
        const rect={type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Polygon',coordinates:[[
            [drawStart[0],drawStart[1]],[lng,drawStart[1]],[lng,lat],[drawStart[0],lat],[drawStart[0],drawStart[1]]
        ]]}}]};
        map.getSource('draw-rect')?.setData(rect);
    }
});

// ─── SEARCH FUNCTIONS ───
async function searchCad(){
    const ci=document.getElementById('cad-com').value,se=document.getElementById('cad-sec').value.toUpperCase().trim(),nu=document.getElementById('cad-num').value.trim().padStart(4,'0');
    if(!ci||!se||!nu){alert('Remplissez tous les champs.');return}
    showLd('Recherche cadastrale...');
    try{const r=await fetch(`https://apicarto.ign.fr/api/cadastre/parcelle?code_insee=${ci}&section=${se}&numero=${nu}`);const d=await r.json();if(d.features?.length>0)showParc(d.features[0]);else{hideLd();alert(`Parcelle ${se} ${nu} non trouvée.`)}}catch(e){hideLd();alert('Erreur réseau.')}
}

async function searchAddr(){
    const a=document.getElementById('addr').value.trim();if(!a){alert('Saisissez une adresse.');return}
    showLd('Géocodage...');
    try{
        const gr=await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(a)}&limit=1`);const gd=await gr.json();
        if(!gd.features?.length){hideLd();alert('Adresse introuvable.');return}
        const[lng,lat]=gd.features[0].geometry.coordinates;
        map.getSource('pin')?.setData({type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[lng,lat]}}]});
        map.flyTo({center:[lng,lat],zoom:16,pitch:55,duration:2000});
        showLd('Recherche parcelle...');
        const r=await fetch('https://apicarto.ign.fr/api/cadastre/parcelle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({geom:{type:'Point',coordinates:[lng,lat]}})});
        const d=await r.json();
        if(d.features?.length>0)showParc(d.features[0]);else{hideLd();alert('Parcelle non trouvée.')}
    }catch(e){hideLd();alert('Erreur réseau.')}
}

async function searchGPS(){
    const lat=parseFloat(document.getElementById('gLat').value),lng=parseFloat(document.getElementById('gLng').value);
    if(isNaN(lat)||isNaN(lng)){alert('Coordonnées invalides.');return}
    showLd('Recherche...');
    map.getSource('pin')?.setData({type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[lng,lat]}}]});
    map.flyTo({center:[lng,lat],zoom:16,pitch:55,duration:2000});
    try{const r=await fetch('https://apicarto.ign.fr/api/cadastre/parcelle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({geom:{type:'Point',coordinates:[lng,lat]}})});const d=await r.json();if(d.features?.length>0)showParc(d.features[0]);else{hideLd();alert('Aucune parcelle trouvée.')}}catch(e){hideLd();alert('Erreur réseau.')}
}

// ─── ADDRESS AUTOCOMPLETE ───
let addrTimeout;
function initAddrAutocomplete(){
    const input=document.getElementById('addr');
    if(!input)return;

    let resultsDiv=document.getElementById('addr-results');
    if(!resultsDiv){
        resultsDiv=document.createElement('div');
        resultsDiv.id='addr-results';
        resultsDiv.style.cssText='position:absolute;background:var(--dk);border:1px solid var(--bd);border-radius:0 0 8px 8px;max-height:200px;overflow-y:auto;z-index:100;display:none;width:100%;min-width:200px;box-shadow:0 4px 12px rgba(0,0,0,0.5)';
        input.parentNode.style.position='relative';
        input.parentNode.appendChild(resultsDiv);
    }

    input.addEventListener('input',e=>{
        clearTimeout(addrTimeout);
        const q=e.target.value.trim();
        if(!q||q.length<3){resultsDiv.style.display='none';return}

        addrTimeout=setTimeout(async()=>{
            try{
                const r=await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5&type=housenumber&lat=16.18&lon=-61.55`);
                const d=await r.json();
                resultsDiv.innerHTML='';
                if(d.features?.length){
                    d.features.forEach(f=>{
                        const opt=document.createElement('div');
                        opt.style.cssText='padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--bd);color:var(--tx);font-size:12px;font-family:inherit';
                        opt.textContent=f.properties.label;
                        opt.onmouseover=()=>opt.style.background='rgba(255,255,255,.05)';
                        opt.onmouseout=()=>opt.style.background='transparent';
                        opt.onclick=async()=>{
                            input.value=f.properties.label;
                            resultsDiv.style.display='none';
                            const[lng,lat]=f.geometry.coordinates;
                            map.getSource('pin')?.setData({type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[lng,lat]}}]});
                            map.flyTo({center:[lng,lat],zoom:16,pitch:55,duration:2000});
                            showLd('Recherche parcelle...');
                            try{
                                const pr=await fetch('https://apicarto.ign.fr/api/cadastre/parcelle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({geom:{type:'Point',coordinates:[lng,lat]}})});
                                const pd=await pr.json();
                                if(pd.features?.length>0)showParc(pd.features[0]);else{hideLd();alert('Parcelle non trouvée.')}
                            }catch(err){hideLd();alert('Erreur réseau.')}
                        };
                        resultsDiv.appendChild(opt);
                    });
                    resultsDiv.style.display='block';
                }else{resultsDiv.style.display='none'}
            }catch(e){console.error('Autocomplete error',e)}
        },300);
    });

    document.addEventListener('click',e=>{
        if(e.target!==input&&e.target.parentNode!==resultsDiv){resultsDiv.style.display='none'}
    });
}

// ─── DRAWING MODE ───
function toggleDrawMode(){
    drawMode=!drawMode;
    document.body.style.cursor=drawMode?'crosshair':'auto';
    drawStart=null;
    map.getSource('draw-rect')?.setData({type:'FeatureCollection',features:[]});

    if(drawMode){
        document.getElementById('mapHint').classList.remove('hidden');
        document.getElementById('mapHint').textContent='Mode zone : 1er clic = point départ, 2e clic = point fin';
    }else{
        document.getElementById('mapHint').classList.add('hidden');
    }
}

function handleDrawClick(e){
    const{lng,lat}=e.lngLat;
    if(!drawStart){
        drawStart=[lng,lat];
    }else{
        const rect={type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Polygon',coordinates:[[
            [drawStart[0],drawStart[1]],[lng,drawStart[1]],[lng,lat],[drawStart[0],lat],[drawStart[0],drawStart[1]]
        ]]}}]};
        map.getSource('draw-rect')?.setData(rect);

        // Calculate area in m²
        const latAvg=(drawStart[1]+lat)/2;
        const mPerDegLng=111000*Math.cos(latAvg*Math.PI/180);
        const mPerDegLat=111000;
        const widthM=Math.abs(lng-drawStart[0])*mPerDegLng;
        const heightM=Math.abs(lat-drawStart[1])*mPerDegLat;
        const areaM2=widthM*heightM;

        drawnArea=areaM2;
        const price=calcZonePrice(areaM2);

        showZoneResult(areaM2,price);
        drawStart=null;
        drawMode=false;
        document.body.style.cursor='auto';
    }
}

function calcZonePrice(areaM2){
    return Math.max(29,Math.min(499,Math.round(areaM2*0.002)));
}

function showZoneResult(areaM2,price){
    document.getElementById('carte-sel').style.display='block';
    document.getElementById('c-ref').textContent='Zone dessinée';
    document.getElementById('c-com').textContent=currentIle==='martinique'?'Martinique':'Guadeloupe';
    document.getElementById('c-surf').textContent=`${areaM2.toFixed(1)} m²`;

    document.getElementById('r-ref').textContent='Zone personnalisée';
    document.getElementById('r-com').textContent=currentIle==='martinique'?'Martinique':'Guadeloupe';
    document.getElementById('r-surf').textContent=`${areaM2.toFixed(1)} m²`;
    document.getElementById('r-sec').textContent=`Surface : ${areaM2.toFixed(1)} m²`;
    document.getElementById('res').classList.add('active');
    document.getElementById('pricing').classList.add('active');

    const pr={essentiel:'59€',complet:'129€',pro:'349€/mois'};
    document.getElementById('orderBtn').textContent=`Commander zone — ${pr.complet}`;
}

// ─── DISPLAY ───
function showParc(f){
    selParc=f;const p=f.properties||{};
    const sec=p.section||'?',num=p.numero||'?',com=p.nom_com||p.commune||'?',surf=p.contenance||p.surfaceParcelle||'?',ref=`${sec} ${num}`;
    map.getSource('parcelle')?.setData({type:'FeatureCollection',features:[f]});

    let ac=[];
    if(f.geometry.type==='Polygon')ac=f.geometry.coordinates[0];
    else if(f.geometry.type==='MultiPolygon')f.geometry.coordinates.forEach(p=>ac.push(...p[0]));
    if(ac.length){const b=ac.reduce((b,c)=>b.extend(c),new maplibregl.LngLatBounds(ac[0],ac[0]));map.fitBounds(b,{padding:100,pitch:55,duration:2000})}

    if(popup)popup.remove();
    const ct=ac.length?[ac.reduce((s,c)=>s+c[0],0)/ac.length,ac.reduce((s,c)=>s+c[1],0)/ac.length]:[0,0];
    popup=new maplibregl.Popup({closeOnClick:false,offset:10}).setLngLat(ct).setHTML(`<strong style="color:#00d4aa">${ref}</strong><br>${com}<br>${surf} m²`).addTo(map);

    document.getElementById('carte-sel').style.display='block';
    document.getElementById('c-ref').textContent=ref;
    document.getElementById('c-com').textContent=com;
    document.getElementById('c-surf').textContent=`${surf} m²`;

    document.getElementById('r-ref').textContent=`971 ${ref}`;
    document.getElementById('r-com').textContent=com;
    document.getElementById('r-surf').textContent=`${surf} m²`;
    document.getElementById('r-sec').textContent=`${sec} / ${num}`;
    document.getElementById('res').classList.add('active');
    document.getElementById('pricing').classList.add('active');
    document.getElementById('genTopoBtn').classList.add('visible');
    document.getElementById('exportPanel').classList.add('active');
    topoData = null; // reset for new parcelle
    hideLd();
}

function clearSel(){
    selParc=null;
    map.getSource('parcelle')?.setData({type:'FeatureCollection',features:[]});
    map.getSource('pin')?.setData({type:'FeatureCollection',features:[]});
    if(popup){popup.remove();popup=null}
    document.getElementById('carte-sel').style.display='none';
    document.getElementById('res').classList.remove('active');
    document.getElementById('pricing').classList.remove('active');
    document.getElementById('genTopoBtn').classList.remove('visible');
    document.getElementById('exportPanel').classList.remove('active');
    document.getElementById('mapHint').classList.remove('hidden');
    topoData = null;
}

// ─── PRICING ───
function selOffer(el,o){
    offer=o;document.querySelectorAll('.po').forEach(p=>p.classList.remove('sel'));el.classList.add('sel');
    const pr={essentiel:'59€',complet:'129€',premium:'249€',pro:'349€/mois'};
    document.getElementById('orderBtn').textContent=`Commander — ${pr[o]}`;
}
function order(){
    if(!selParc){alert('Sélectionnez une parcelle.');return}

    // Validate email
    const emailInput = document.getElementById('clientEmail');
    const email = emailInput?.value?.trim();
    if(!email || !email.includes('@')){
        emailInput?.focus();
        alert('Veuillez renseigner votre email pour recevoir les fichiers.');
        return;
    }

    // Stripe Payment Links per offer
    const PAYMENT_LINKS = {
        essentiel: 'https://buy.stripe.com/14AdRafggaiH8GL9OH0Jq03',
        complet:   'https://buy.stripe.com/fZu00k1pqfD11ej4un0Jq04',
        premium:   'https://buy.stripe.com/cNi4gA3xy8azbSXf910Jq05'
    };

    const link = PAYMENT_LINKS[offer];
    if(!link){
        alert('Offre Pro : contactez-nous à contact@topo3d-antilles.com');
        return;
    }

    const p = selParc.properties || {};

    // Encode parcel info into client_reference_id (max 200 chars)
    // Format: codeInsee|section|numero|commune|surface|interval|resolution|majorEvery
    const refData = [
        p.code_insee || '',
        p.section || '',
        p.numero || '',
        (p.nom_com || p.commune || '').substring(0, 30),
        p.contenance || 0,
        1,  // interval
        5,  // resolution
        5   // majorEvery
    ].join('|');

    // Build Stripe Payment Link URL with params
    const url = new URL(link);
    url.searchParams.set('client_reference_id', refData);
    url.searchParams.set('prefilled_email', email);

    // Show loading then redirect
    const btn = document.getElementById('orderBtn');
    btn.disabled = true;
    btn.textContent = 'Redirection vers Stripe...';

    window.location.href = url.toString();
}

function showLd(t){document.getElementById('ld').classList.add('on');document.getElementById('ldTxt').textContent=t||'Recherche...'}
function hideLd(){document.getElementById('ld').classList.remove('on')}

// ─── KEYBOARD ───
document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(document.getElementById('topoModal').classList.contains('open')){closeTopoPlan()}else{clearSel()}}
    if(e.key==='Enter'){const t=document.querySelector('.tab.active')?.dataset.tab;if(t==='cadastre')searchCad();else if(t==='adresse')searchAddr();else if(t==='gps')searchGPS()}
});

// ═══════════════════════════════════════════════
// TOPO PLAN GENERATOR — Courbes de niveau
// ═══════════════════════════════════════════════
var topoData = null; // {grid, xi, yi, zMin, zMax, bbox, parcCoords}

function openTopoPlan() {
    document.getElementById('topoModal').classList.add('open');
    if (selParc && !topoData) {
        document.getElementById('topoStatusText').textContent = 'Prêt à générer. Cliquez "Générer" pour collecter les données d\'altitude.';
    }
}
function closeTopoPlan() { document.getElementById('topoModal').classList.remove('open'); }

async function generateTopoPlan() {
    if (!selParc) { alert('Sélectionnez d\'abord une parcelle.'); return; }

    const res = parseFloat(document.getElementById('topo-res').value);
    const geom = selParc.geometry;
    let allCoords = [];
    if (geom.type === 'Polygon') allCoords = geom.coordinates[0];
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(p => allCoords.push(...p[0]));

    const lngs = allCoords.map(c => c[0]), lats = allCoords.map(c => c[1]);
    const bufDeg = 20 / 111000;
    const bbox = {
        minLng: Math.min(...lngs) - bufDeg,
        maxLng: Math.max(...lngs) + bufDeg,
        minLat: Math.min(...lats) - bufDeg,
        maxLat: Math.max(...lats) + bufDeg
    };

    const mPerDegLat = 111000;
    const mPerDegLng = 111000 * Math.cos((bbox.minLat + bbox.maxLat) / 2 * Math.PI / 180);
    const latStep = res / mPerDegLat;
    const lngStep = res / mPerDegLng;

    const gridLats = [], gridLngs = [];
    for (let lat = bbox.minLat; lat <= bbox.maxLat; lat += latStep)
        for (let lng = bbox.minLng; lng <= bbox.maxLng; lng += lngStep) {
            gridLats.push(lat); gridLngs.push(lng);
        }

    const nCols = Math.ceil((bbox.maxLng - bbox.minLng) / lngStep);
    const nRows = Math.ceil((bbox.maxLat - bbox.minLat) / latStep);
    const total = gridLats.length;

    document.getElementById('topoStatusText').textContent = `Collecte de ${total} points d'altitude...`;
    document.getElementById('topoStatusMeta').textContent = `Grille ${nCols}×${nRows} — pas ${res}m`;

    // Fetch elevation by batches of 150
    const elevations = new Array(total).fill(null);
    const batchSize = 150;
    for (let i = 0; i < total; i += batchSize) {
        const bLats = gridLats.slice(i, i + batchSize);
        const bLngs = gridLngs.slice(i, i + batchSize);
        const lonStr = bLngs.map(x => x.toFixed(6)).join('|');
        const latStr = bLats.map(x => x.toFixed(6)).join('|');

        try {
            const r = await fetch(`https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?lon=${lonStr}&lat=${latStr}&resource=ign_rge_alti_wld&zonly=false`);
            const d = await r.json();
            if (d.elevations) d.elevations.forEach((pt, j) => { elevations[i + j] = (pt.z === -99999 || pt.z === -9999) ? null : pt.z; });
        } catch (e) { console.error('Elevation batch error', e); }

        const progress = Math.min(i + batchSize, total);
        document.getElementById('topoStatusText').textContent = `Collecte altitude : ${progress}/${total} (${Math.round(100 * progress / total)}%)`;
        await new Promise(r => setTimeout(r, 100));
    }

    // Build 2D grid for contouring
    const grid = [];
    let zMin = Infinity, zMax = -Infinity;
    for (let r = 0; r < nRows; r++) {
        grid[r] = [];
        for (let c = 0; c < nCols; c++) {
            const idx = r * nCols + c;
            const z = idx < elevations.length ? elevations[idx] : null;
            grid[r][c] = z;
            if (z !== null) { if (z < zMin) zMin = z; if (z > zMax) zMax = z; }
        }
    }

    // Interpolate nulls with neighbor average
    for (let r = 0; r < nRows; r++)
        for (let c = 0; c < nCols; c++)
            if (grid[r][c] === null) {
                let sum = 0, cnt = 0;
                for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < nRows && nc >= 0 && nc < nCols && grid[nr][nc] !== null) { sum += grid[nr][nc]; cnt++; }
                }
                grid[r][c] = cnt > 0 ? sum / cnt : zMin;
            }

    // Convert parcelle coords to local
    const parcLocal = allCoords.map(c => [
        (c[0] - bbox.minLng) * mPerDegLng,
        (c[1] - bbox.minLat) * mPerDegLat
    ]);

    // Récupérer toutes les parcelles voisines (parcellaire complet)
    document.getElementById('topoStatusText').textContent = 'Chargement du parcellaire...';
    let neighborParcels = [];
    try {
        const bboxPoly = {type:'Polygon',coordinates:[[[bbox.minLng,bbox.minLat],[bbox.maxLng,bbox.minLat],[bbox.maxLng,bbox.maxLat],[bbox.minLng,bbox.maxLat],[bbox.minLng,bbox.minLat]]]};
        const pr = await fetch('https://apicarto.ign.fr/api/cadastre/parcelle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({geom:bboxPoly})});
        const pd = await pr.json();
        if (pd.features) {
            const selId = selParc.properties?.idu || '';
            neighborParcels = pd.features.filter(f => (f.properties?.idu || '') !== selId).map(f => {
                let coords = [];
                if (f.geometry.type === 'Polygon') coords = f.geometry.coordinates[0];
                else if (f.geometry.type === 'MultiPolygon') f.geometry.coordinates.forEach(p => coords.push(...p[0]));
                return {
                    local: coords.map(c => [(c[0] - bbox.minLng) * mPerDegLng, (c[1] - bbox.minLat) * mPerDegLat]),
                    props: f.properties || {}
                };
            });
        }
    } catch (e) { console.warn('Parcellaire voisin indisponible:', e); }

    topoData = { grid, nCols, nRows, zMin, zMax, bbox, mPerDegLat, mPerDegLng, parcLocal, neighborParcels, res };
    document.getElementById('topoStatusText').textContent = `Terminé — Alt. ${zMin.toFixed(1)}m à ${zMax.toFixed(1)}m — Δ${(zMax - zMin).toFixed(1)}m — ${neighborParcels.length + 1} parcelles`;
    redrawTopoPlan();
}

// ─── TOPO DRAWING ENGINE (calibré DPI / échelle) ───
var TOPO_DPI = 200; // résolution export (200 DPI = haute qualité impression)
var MM_TO_PX = TOPO_DPI / 25.4; // 1mm en pixels à 200 DPI ≈ 7.87

function getTopoScale(widthM, heightM) {
    // Choisir l'échelle standard la plus adaptée à un A4 paysage (277×190mm zone utile)
    const printW = 277, printH = 150; // mm zone dessin (marge cartouche en bas)
    const candidates = [100,200,250,500,1000,2000,2500,5000,10000];
    for (const s of candidates) {
        const pw = (widthM / s) * 1000, ph = (heightM / s) * 1000; // taille papier en mm
        if (pw <= printW && ph <= printH) return s;
    }
    return candidates[candidates.length - 1];
}

function redrawTopoPlan() {
    if (!topoData) return;
    const { grid, nCols, nRows, zMin, zMax, bbox, mPerDegLng, mPerDegLat, parcLocal, neighborParcels, res } = topoData;
    const interval = parseFloat(document.getElementById('topo-interval').value);
    const majorEvery = parseFloat(document.getElementById('topo-major').value);
    const style = document.getElementById('topo-style').value;
    const showParc = document.getElementById('topo-show-parcelle').checked;
    const showPts = document.getElementById('topo-show-points').checked;
    const showGrad = document.getElementById('topo-show-gradient').checked;

    const widthM = (bbox.maxLng - bbox.minLng) * mPerDegLng;
    const heightM = (bbox.maxLat - bbox.minLat) * mPerDegLat;

    // Échelle calibrée
    const numScale = getTopoScale(widthM, heightM);
    const pxPerM = (1000 / numScale) * MM_TO_PX; // pixels par mètre terrain

    // Marges (en pixels)
    const marginL = 50, marginR = 30, marginT = 50, marginB = 100; // cartouche 80px + 20px padding
    const drawW = Math.round(widthM * pxPerM);
    const drawH = Math.round(heightM * pxPerM);
    const cw = drawW + marginL + marginR;
    const ch = drawH + marginT + marginB;

    const canvas = document.getElementById('topoCanvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');

    // Stocker l'échelle pour exports
    topoData._numScale = numScale;
    topoData._pxPerM = pxPerM;
    topoData._cw = cw;
    topoData._ch = ch;
    topoData._marginL = marginL;
    topoData._marginT = marginT;
    topoData._marginB = marginB;
    topoData._drawW = drawW;
    topoData._drawH = drawH;

    // Theme
    const themes = {
        classic: { bg: '#FFFFFF', minor: '#9B8365', major: '#3A2718', label: '#2A1A0A', parcel: '#00B894', parcelFill: '#00B89418', pts: '#555', gridCol: '#F0EBE5', frame: '#4A3728', minorW: 0.6, majorW: 1.8 },
        dark: { bg: '#0A0A14', minor: '#5A8A7A', major: '#00D4AA', label: '#00D4AA', parcel: '#00D4AA', parcelFill: '#00D4AA20', pts: '#888', gridCol: '#141420', frame: '#00D4AA', minorW: 0.7, majorW: 2.0 },
        topo: { bg: '#F5F0E8', minor: '#B08050', major: '#6B3E1C', label: '#4C2A0E', parcel: '#00A67E', parcelFill: '#00A67E18', pts: '#555', gridCol: '#EDE4D8', frame: '#5C3A1E', minorW: 0.6, majorW: 1.8 },
        print: { bg: '#FAFAFA', minor: '#888888', major: '#333333', label: '#1A1A1A', parcel: '#00896C', parcelFill: '#00896C12', pts: '#777', gridCol: '#F3F3F3', frame: '#222222', minorW: 0.5, majorW: 1.3 },
    };
    const th = themes[style] || themes.classic;

    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, cw, ch);

    const ox = marginL, oy = marginB;
    const toX = c => ox + c * (res * pxPerM);
    const toY = r => ch - oy - r * (res * pxPerM);

    // Cadre zone dessin
    ctx.strokeStyle = th.frame; ctx.lineWidth = 1.5;
    ctx.strokeRect(ox, marginT, drawW, drawH);

    // Grille métrique
    const gridStepM = numScale <= 500 ? 10 : numScale <= 1000 ? 20 : numScale <= 2000 ? 50 : 100;
    ctx.strokeStyle = th.gridCol; ctx.lineWidth = 0.3;
    ctx.font = `${Math.max(7, 9 * MM_TO_PX / 6)}px Arial`; ctx.fillStyle = th.minor; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let m = 0; m <= widthM; m += gridStepM) {
        const px = ox + m * pxPerM;
        if (px > ox + drawW) break;
        ctx.beginPath(); ctx.moveTo(px, marginT); ctx.lineTo(px, ch - oy); ctx.stroke();
        if (m % (gridStepM * 2) === 0) ctx.fillText(`${m.toFixed(0)}`, px, ch - oy + 3);
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let m = 0; m <= heightM; m += gridStepM) {
        const py = ch - oy - m * pxPerM;
        if (py < marginT) break;
        ctx.beginPath(); ctx.moveTo(ox, py); ctx.lineTo(ox + drawW, py); ctx.stroke();
        if (m % (gridStepM * 2) === 0) ctx.fillText(`${m.toFixed(0)}`, ox - 4, py);
    }

    // Gradient background
    if (showGrad) {
        for (let r = 0; r < nRows - 1; r++)
            for (let c = 0; c < nCols - 1; c++) {
                const z = grid[r][c];
                if (z === null) continue;
                const t = (z - zMin) / (zMax - zMin || 1);
                const hue = 120 - t * 120;
                ctx.fillStyle = `hsla(${hue},50%,50%,0.15)`;
                ctx.fillRect(toX(c), toY(r + 1), res * pxPerM + 1, res * pxPerM + 1);
            }
    }

    // ─── Marching squares → segments bruts ───
    function getContourSegs(level) {
        const segs = [];
        for (let r = 0; r < nRows - 1; r++) {
            for (let c = 0; c < nCols - 1; c++) {
                const z00 = grid[r][c], z10 = grid[r][c + 1], z01 = grid[r + 1][c], z11 = grid[r + 1][c + 1];
                if (z00 === null || z10 === null || z01 === null || z11 === null) continue;
                const idx = ((z00 >= level) ? 8 : 0) | ((z10 >= level) ? 4 : 0) | ((z11 >= level) ? 2 : 0) | ((z01 >= level) ? 1 : 0);
                if (idx === 0 || idx === 15) continue;
                const interp = (za, zb) => (za === zb) ? 0.5 : (level - za) / (zb - za);
                const top = { x: toX(c + interp(z00, z10)), y: toY(r) };
                const right = { x: toX(c + 1), y: toY(r + interp(z10, z11)) };
                const bottom = { x: toX(c + interp(z01, z11)), y: toY(r + 1) };
                const left = { x: toX(c), y: toY(r + interp(z00, z01)) };
                const s = [];
                switch (idx) {
                    case 1: case 14: s.push([left, bottom]); break;
                    case 2: case 13: s.push([bottom, right]); break;
                    case 3: case 12: s.push([left, right]); break;
                    case 4: case 11: s.push([top, right]); break;
                    case 5: s.push([left, top], [bottom, right]); break;
                    case 6: case 9: s.push([top, bottom]); break;
                    case 7: case 8: s.push([left, top]); break;
                    case 10: s.push([left, bottom], [top, right]); break;
                }
                s.forEach(seg => segs.push(seg));
            }
        }
        return segs;
    }

    // ─── Chaînage : segments → polylignes continues ───
    function chainSegments(segs) {
        if (segs.length === 0) return [];
        const eps = 0.5; // tolérance pixels
        const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        const used = new Array(segs.length).fill(false);
        const chains = [];

        for (let i = 0; i < segs.length; i++) {
            if (used[i]) continue;
            used[i] = true;
            const chain = [segs[i][0], segs[i][1]];
            let changed = true;
            while (changed) {
                changed = false;
                for (let j = 0; j < segs.length; j++) {
                    if (used[j]) continue;
                    const head = chain[0], tail = chain[chain.length - 1];
                    if (dist(tail, segs[j][0]) < eps) { chain.push(segs[j][1]); used[j] = true; changed = true; }
                    else if (dist(tail, segs[j][1]) < eps) { chain.push(segs[j][0]); used[j] = true; changed = true; }
                    else if (dist(head, segs[j][1]) < eps) { chain.unshift(segs[j][0]); used[j] = true; changed = true; }
                    else if (dist(head, segs[j][0]) < eps) { chain.unshift(segs[j][1]); used[j] = true; changed = true; }
                }
            }
            if (chain.length >= 2) chains.push(chain);
        }
        return chains;
    }

    // ─── Lissage Catmull-Rom spline → Canvas quadratic ───
    function drawSmoothChain(ctx, pts) {
        if (pts.length < 2) return;
        if (pts.length === 2) { ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); return; }
        ctx.moveTo(pts[0].x, pts[0].y);
        if (pts.length === 3) {
            ctx.quadraticCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
            return;
        }
        // Catmull-Rom → quadratic Bézier approximation
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(i - 1, 0)];
            const p1 = pts[i];
            const p2 = pts[Math.min(i + 1, pts.length - 1)];
            const p3 = pts[Math.min(i + 2, pts.length - 1)];
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }
    }

    // ─── SVG path string pour une chaîne lissée ───
    function smoothChainToSVG(pts) {
        if (pts.length < 2) return '';
        if (pts.length === 2) return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}L${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`;
        let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
        if (pts.length === 3) { d += `Q${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)},${pts[2].x.toFixed(1)},${pts[2].y.toFixed(1)}`; return d; }
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[Math.min(i + 1, pts.length - 1)], p3 = pts[Math.min(i + 2, pts.length - 1)];
            const cp1x = p1.x + (p2.x - p0.x) / 6, cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6, cp2y = p2.y - (p3.y - p1.y) / 6;
            d += `C${cp1x.toFixed(1)},${cp1y.toFixed(1)},${cp2x.toFixed(1)},${cp2y.toFixed(1)},${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
        }
        return d;
    }

    // ─── Rendu des courbes lissées ───
    const contourData = [];
    const levels = [];
    for (let z = Math.ceil(zMin / interval) * interval; z <= zMax; z += interval) levels.push(z);

    // Collision detection pour les labels
    const usedBoxes = [];
    function boxOverlaps(bx, by, bw, bh) {
        for (const b of usedBoxes) {
            if (bx < b.x + b.w && bx + bw > b.x && by < b.y + b.h && by + bh > b.y) return true;
        }
        return false;
    }
    function reserveBox(bx, by, bw, bh) { usedBoxes.push({ x: bx, y: by, w: bw, h: bh }); }

    levels.forEach(level => {
        const isMajor = Math.abs(level % majorEvery) < 0.01 || Math.abs(level % majorEvery - majorEvery) < 0.01;
        const segs = getContourSegs(level);
        const chains = chainSegments(segs);
        contourData.push({ level, isMajor, chains });

        ctx.strokeStyle = isMajor ? th.major : th.minor;
        ctx.lineWidth = isMajor ? (th.majorW || 1.8) : (th.minorW || 0.7);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath();
        chains.forEach(chn => drawSmoothChain(ctx, chn));
        ctx.stroke();

        // Labels altitude sur majeures — avec anti-collision
        if (isMajor) {
            chains.forEach(chain => {
                if (chain.length < 4) return;
                const txt = `${level.toFixed(0)}m`;
                const tw = 38, th2 = 16;
                // Essayer milieu, puis 1/3, puis 2/3 de la chaîne
                const candidates = [0.5, 0.33, 0.67, 0.2, 0.8];
                let placed = false;
                for (const frac of candidates) {
                    const idx = Math.floor(chain.length * frac);
                    const pt = chain[Math.min(idx, chain.length - 1)];
                    const lx = pt.x - tw / 2, ly = pt.y - th2 / 2;
                    // Vérifier que le label est dans la zone de dessin
                    if (lx < ox || lx + tw > ox + drawW || ly < marginT || ly + th2 > ch - marginB) continue;
                    if (!boxOverlaps(lx, ly, tw, th2)) {
                        reserveBox(lx - 2, ly - 2, tw + 4, th2 + 4); // marge de sécurité
                        ctx.fillStyle = th.bg;
                        ctx.fillRect(lx, ly, tw, th2);
                        ctx.fillStyle = th.label;
                        ctx.font = 'bold 10px Arial';
                        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.fillText(txt, pt.x, pt.y);
                        placed = true;
                        break;
                    }
                }
            });
        }
    });
    topoData._contourData = contourData;
    topoData._th = th;

    // ─── Parcellaire voisin (toutes les parcelles de la zone) ───
    if (showParc && neighborParcels && neighborParcels.length > 0) {
        const parcCol = style === 'dark' ? '#4A4A65' : '#9A9A9A';
        const parcLabelCol = style === 'dark' ? '#606080' : '#888888';
        ctx.setLineDash([]);

        neighborParcels.forEach(np => {
            if (np.local.length < 2) return;
            const pts = np.local.map(pt => ({ x: ox + pt[0] * pxPerM, y: ch - oy - pt[1] * pxPerM }));
            // Contour parcelle voisine
            ctx.strokeStyle = parcCol; ctx.lineWidth = 0.9;
            ctx.lineJoin = 'miter';
            ctx.beginPath();
            pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
            ctx.closePath(); ctx.stroke();
            // Numéro parcelle (discret)
            if (np.props.numero && pts.length > 2) {
                const cx = pts.reduce((s, pt) => s + pt.x, 0) / pts.length;
                const cy = pts.reduce((s, pt) => s + pt.y, 0) / pts.length;
                ctx.font = '7px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = parcLabelCol;
                ctx.fillText(np.props.numero, cx, cy);
            }
        });
    }

    // ─── Parcelle sélectionnée : contour bleu-vert Topo3D + remplissage translucide ───
    if (showParc && parcLocal.length > 1) {
        const parcPts = parcLocal.map(pt => ({ x: ox + pt[0] * pxPerM, y: ch - oy - pt[1] * pxPerM }));
        // Remplissage translucide
        ctx.fillStyle = th.parcelFill || (th.parcel + '15');
        ctx.beginPath();
        parcPts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
        ctx.closePath(); ctx.fill();
        // Trait plein
        ctx.strokeStyle = th.parcel; ctx.lineWidth = 2.8;
        ctx.setLineDash([]); ctx.lineJoin = 'miter';
        ctx.beginPath();
        parcPts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
        ctx.closePath(); ctx.stroke();
        // Sommets (petits cercles)
        ctx.fillStyle = th.parcel;
        parcPts.forEach(pt => { ctx.beginPath(); ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2); ctx.fill(); });
        // Label "Parcelle" au centroïde
        const cx = parcPts.reduce((s, pt) => s + pt.x, 0) / parcPts.length;
        const cy = parcPts.reduce((s, pt) => s + pt.y, 0) / parcPts.length;
        ctx.font = 'bold 10px Arial'; ctx.fillStyle = th.parcel;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const pp = selParc?.properties || {};
        ctx.fillText(`${pp.section||''} ${pp.numero||''}`, cx, cy);
    }

    // Points cotés
    if (showPts) {
        ctx.fillStyle = th.pts; ctx.font = '7.5px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        const step = Math.max(2, Math.floor(Math.max(nRows, nCols) / 8));
        for (let r = 0; r < nRows; r += step)
            for (let c = 0; c < nCols; c += step) {
                if (grid[r][c] === null) continue;
                const px = toX(c), py = toY(r);
                // Croix topo au lieu de point
                ctx.strokeStyle = th.pts; ctx.lineWidth = 0.8;
                ctx.beginPath(); ctx.moveTo(px - 3, py); ctx.lineTo(px + 3, py); ctx.moveTo(px, py - 3); ctx.lineTo(px, py + 3); ctx.stroke();
                ctx.fillText(grid[r][c].toFixed(1) + 'm', px + 5, py - 2);
            }
    }

    // ═══ CARTOUCHE PROFESSIONNEL (5 colonnes, 80px) ═══
    const p = selParc?.properties || {};
    const cartH = 80;
    const cartY = ch - cartH;
    const cartW = cw;

    // Fond + cadre double
    ctx.fillStyle = th.bg; ctx.fillRect(0, cartY - 1, cartW, cartH + 2);
    ctx.strokeStyle = th.frame; ctx.lineWidth = 1.5;
    ctx.strokeRect(2, cartY, cartW - 4, cartH);
    ctx.lineWidth = 0.4;
    ctx.strokeRect(4, cartY + 2, cartW - 8, cartH - 4);

    // Colonnes
    const cols = [4, cartW * 0.24, cartW * 0.40, cartW * 0.60, cartW * 0.80];
    ctx.lineWidth = 0.6; ctx.strokeStyle = th.frame;
    for (let i = 1; i < cols.length; i++) {
        ctx.beginPath(); ctx.moveTo(cols[i], cartY + 2); ctx.lineTo(cols[i], cartY + cartH - 2); ctx.stroke();
    }

    const fT = 'bold 12px Arial', fB = 'bold 10px Arial', fN = '9px Arial', fS = '8px Arial';
    const dy = 15; // espacement vertical entre rangées
    const r1 = cartY + 15, r2 = r1 + dy, r3 = r2 + dy, r4 = r3 + dy, r5 = r4 + dy;
    const pad = 6;

    // ── Col 1 : Titre + Réf ──
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = fT; ctx.fillStyle = th.label;
    ctx.fillText('PLAN TOPOGRAPHIQUE', cols[0] + pad, r1);
    ctx.font = fB; ctx.fillStyle = th.major;
    ctx.fillText(`${p.section||'—'} ${p.numero||'—'} — ${p.nom_com||p.commune||'—'}`, cols[0] + pad, r2);
    ctx.font = fN; ctx.fillStyle = th.minor;
    ctx.fillText(`Surface : ${p.contenance ? p.contenance.toLocaleString('fr-FR') + ' m²' : '—'}`, cols[0] + pad, r3);
    ctx.font = fS;
    ctx.fillText(`INSEE : ${p.code_com||p.code_insee||'—'}`, cols[0] + pad, r4);

    // ── Col 2 : Échelle + Alt ──
    ctx.font = fT; ctx.fillStyle = th.label;
    ctx.fillText(`1 : ${numScale}`, cols[1] + pad, r1);
    ctx.font = fN; ctx.fillStyle = th.major;
    ctx.fillText(`Alt. ${zMin.toFixed(1)} → ${zMax.toFixed(1)}m`, cols[1] + pad, r2);
    ctx.fillText(`Δ ${(zMax - zMin).toFixed(1)}m`, cols[1] + pad, r3);
    ctx.font = fS; ctx.fillStyle = th.minor;
    ctx.fillText(`Int. ${interval}m | Maj. ${majorEvery}m | Rés. ${res}m`, cols[1] + pad, r4);

    // ── Col 3 : Légende (5 lignes) ──
    ctx.font = fB; ctx.fillStyle = th.label;
    ctx.fillText('LÉGENDE', cols[2] + pad, r1);
    const lx = cols[2] + pad, lw = 18;

    // Courbe majeure
    ctx.strokeStyle = th.major; ctx.lineWidth = th.majorW || 1.8; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(lx, r2); ctx.lineTo(lx + lw, r2); ctx.stroke();
    ctx.font = fS; ctx.fillStyle = th.label;
    ctx.fillText('Courbe majeure', lx + lw + 3, r2);

    // Courbe mineure
    ctx.strokeStyle = th.minor; ctx.lineWidth = th.minorW || 0.5;
    ctx.beginPath(); ctx.moveTo(lx, r3); ctx.lineTo(lx + lw, r3); ctx.stroke();
    ctx.fillText('Courbe mineure', lx + lw + 3, r3);

    // Parcelle sélectionnée
    ctx.strokeStyle = th.parcel; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(lx, r4); ctx.lineTo(lx + lw, r4); ctx.stroke();
    ctx.fillStyle = th.parcel;
    ctx.beginPath(); ctx.arc(lx, r4, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(lx + lw, r4, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = th.label;
    ctx.fillText('Parcelle sélectionnée', lx + lw + 3, r4);

    // Parcellaire voisin
    const parcCartCol = style === 'dark' ? '#4A4A65' : '#9A9A9A';
    ctx.strokeStyle = parcCartCol; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(lx, r5); ctx.lineTo(lx + lw, r5); ctx.stroke();
    ctx.fillText('Parcellaire cadastral', lx + lw + 3, r5);

    // ── Col 4 : Coordonnées ──
    const cLat = ((bbox.minLat + bbox.maxLat) / 2).toFixed(6);
    const cLng = ((bbox.minLng + bbox.maxLng) / 2).toFixed(6);
    ctx.font = fB; ctx.fillStyle = th.label;
    ctx.fillText('COORDONNÉES', cols[3] + pad, r1);
    ctx.font = fN; ctx.fillStyle = th.major;
    ctx.fillText(`Lat : ${cLat}°N`, cols[3] + pad, r2);
    ctx.fillText(`Lon : ${cLng}°W`, cols[3] + pad, r3);
    ctx.font = fS; ctx.fillStyle = th.minor;
    ctx.fillText('Système : WGS84', cols[3] + pad, r4);
    ctx.fillText('Projection : UTM 20N', cols[3] + pad, r5);

    // ── Col 5 : Source + Date ──
    ctx.font = fB; ctx.fillStyle = th.label;
    ctx.fillText('Topo3D-Antilles', cols[4] + pad, r1);
    ctx.font = fN; ctx.fillStyle = th.major;
    const now = new Date();
    ctx.fillText(now.toLocaleDateString('fr-FR'), cols[4] + pad, r2);
    ctx.font = fS; ctx.fillStyle = th.minor;
    ctx.fillText('Source altitude : IGN RGE ALTI', cols[4] + pad, r3);
    ctx.fillText('Source cadastre : PCI Express', cols[4] + pad, r4);
    ctx.fillText('topo3d-antilles.com', cols[4] + pad, r5);

    // ═══ BARRE D'ÉCHELLE GRAPHIQUE (dans le plan) ═══
    const barLenM = numScale <= 200 ? 10 : numScale <= 500 ? 20 : numScale <= 1000 ? 50 : numScale <= 2000 ? 100 : 200;
    const barLenPx = barLenM * pxPerM;
    const bx = ox + drawW - barLenPx - 10, by = ch - oy - 30;
    // Fond blanc semi-transparent
    ctx.fillStyle = th.bg + '99';
    ctx.fillRect(bx - 6, by - 16, barLenPx + 16, 26);
    // Barre alternée noir/blanc
    const nSeg = barLenM <= 20 ? 2 : 4;
    const segPx = barLenPx / nSeg;
    for (let i = 0; i < nSeg; i++) {
        ctx.fillStyle = i % 2 === 0 ? th.frame : th.bg;
        ctx.fillRect(bx + i * segPx, by, segPx, 5);
    }
    ctx.strokeStyle = th.frame; ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, barLenPx, 5);
    // Labels
    ctx.fillStyle = th.label; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('0', bx, by - 2);
    ctx.fillText(`${barLenM} m`, bx + barLenPx, by - 2);
    ctx.textAlign = 'center';
    ctx.fillText(`1:${numScale}`, bx + barLenPx / 2, by - 2);

    // ═══ SYMBOLE NORD — style architecte (cercle + flèche fine) ═══
    const nx = ox + drawW - 22, ny = marginT + 30;
    const nr = 18; // rayon du cercle
    // Fond blanc
    ctx.fillStyle = th.bg;
    ctx.beginPath(); ctx.arc(nx, ny, nr + 4, 0, Math.PI * 2); ctx.fill();
    // Cercle fin
    ctx.strokeStyle = th.frame; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2); ctx.stroke();
    // Petit cercle centre
    ctx.beginPath(); ctx.arc(nx, ny, 2, 0, Math.PI * 2); ctx.fillStyle = th.frame; ctx.fill();
    // Flèche nord (trait fin vers le haut)
    ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(nx, ny + nr - 3); ctx.lineTo(nx, ny - nr + 3); ctx.stroke();
    // Pointe de flèche
    ctx.beginPath(); ctx.moveTo(nx, ny - nr + 1); ctx.lineTo(nx - 4, ny - nr + 9); ctx.lineTo(nx + 4, ny - nr + 9); ctx.closePath();
    ctx.fillStyle = th.frame; ctx.fill();
    // Traits E-W (discrets)
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(nx - nr + 3, ny); ctx.lineTo(nx + nr - 3, ny); ctx.stroke();
    // Lettre N
    ctx.font = 'bold 11px Arial'; ctx.fillStyle = th.label;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('N', nx, ny - nr - 3);

    // Masquer la légende HTML (elle est maintenant intégrée dans le cartouche canvas)
    document.getElementById('topoLegend').style.display = 'none';
}

// ═══ EXPORT PNG HAUTE RÉSOLUTION ═══
// ═══ GATING GRATUIT / PAYANT ═══
// PNG + PDF = gratuit (produit d'appel), SVG = Complet+, 3D exports = selon offre
const EXPORT_ACCESS = {
    png: 'free', pdf: 'free',
    svg: 'complet', geojson: 'free',
    obj: 'essentiel', dxf: 'complet', stl: 'complet',
    ifc: 'premium', dwg: 'premium', rvt: 'pro', pln: 'pro'
};
const OFFER_RANK = { free: 0, essentiel: 1, complet: 2, premium: 3, pro: 4 };
let userOffer = 'free'; // 'free' par défaut, mis à jour après paiement/login pro

// ═══ BETA MODE — si cookie session active, débloquer tous les exports ═══
if (document.cookie.includes('topo3d_session=')) {
    userOffer = 'pro';
    console.log('[BETA] Mode beta actif — tous les exports débloqués');
}

function canExport(format) {
    const required = EXPORT_ACCESS[format] || 'premium';
    return OFFER_RANK[userOffer] >= OFFER_RANK[required];
}

function showUpgradePrompt(format) {
    const required = EXPORT_ACCESS[format] || 'premium';
    const names = { essentiel: 'Essentiel (59€)', complet: 'Complet (129€)', premium: 'Premium (249€)', pro: 'Pro (349€/mois)' };
    const msg = `L'export ${format.toUpperCase()} nécessite l'offre ${names[required] || required}.\n\nVotre plan actuel : ${userOffer === 'free' ? 'Gratuit' : userOffer}\n\nLes formats PNG et PDF sont gratuits.\nCommandez une offre pour débloquer les exports vectoriels et 3D.`;
    alert(msg);
    // Scroll to pricing
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
}

// ═══ EXPORT PNG — GRATUIT ═══
function downloadTopoPNG() {
    if (!topoData) { alert('Générez d\'abord le plan.'); return; }
    const canvas = document.getElementById('topoCanvas');
    const a = document.createElement('a');
    a.download = `topo_${selParc?.properties?.section||'X'}_${selParc?.properties?.numero||'0'}_1-${topoData._numScale||'?'}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
}

// ═══ EXPORT SVG VECTORIEL — OFFRE COMPLET+ ═══
function downloadTopoSVG() {
    if (!canExport('svg')) { showUpgradePrompt('svg'); return; }
    if (!topoData || !topoData._contourData) { alert('Générez d\'abord le plan.'); return; }
    const { zMin, zMax, parcLocal, _contourData, _th, _cw, _ch, _numScale, _pxPerM, _marginL, _marginT, _marginB, _drawW, _drawH } = topoData;
    const th = _th;
    const p = selParc?.properties || {};
    const showParc = document.getElementById('topo-show-parcelle').checked;

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${_cw}" height="${_ch}" viewBox="0 0 ${_cw} ${_ch}">
<title>Plan topographique — ${p.section||''} ${p.numero||''} — ${p.nom_com||''} — 1:${_numScale}</title>
<rect width="${_cw}" height="${_ch}" fill="${th.bg}"/>
<rect x="${_marginL}" y="${_marginT}" width="${_drawW}" height="${_drawH}" fill="none" stroke="${th.frame}" stroke-width="1.5"/>
`;

    // Contours vectoriels lissés
    _contourData.forEach(({ level, isMajor, chains }) => {
        if (!chains || chains.length === 0) return;
        chains.forEach(chain => {
            const d = smoothChainToSVG(chain);
            if (!d) return;
            svg += `<path d="${d}" fill="none" stroke="${isMajor ? th.major : th.minor}" stroke-width="${isMajor ? (th.majorW||1.5) : (th.minorW||0.5)}" stroke-linecap="round" stroke-linejoin="round"/>
`;
        });
        // Labels altitude sur majeures
        if (isMajor) {
            chains.forEach(chain => {
                if (chain.length < 4) return;
                const mid = chain[Math.floor(chain.length / 2)];
                const mx = mid.x.toFixed(1), my = mid.y.toFixed(1);
                svg += `<rect x="${(mid.x - 18).toFixed(1)}" y="${(mid.y - 8).toFixed(1)}" width="36" height="16" rx="2" fill="${th.bg}"/>
<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="central" font-family="Arial" font-size="10" font-weight="bold" fill="${th.label}">${level.toFixed(0)}m</text>
`;
            });
        }
    });

    // Parcelle vectorielle
    if (showParc && parcLocal.length > 1) {
        const ox = _marginL, oy = _marginB;
        let d = '';
        parcLocal.forEach((pt, i) => {
            const px = (ox + pt[0] * _pxPerM).toFixed(1), py = (_ch - oy - pt[1] * _pxPerM).toFixed(1);
            d += i === 0 ? `M${px},${py}` : `L${px},${py}`;
        });
        d += 'Z';
        svg += `<path d="${d}" fill="${th.parcel}15" stroke="${th.parcel}" stroke-width="2.5"/>
`;
        // Sommets parcelle
        parcLocal.forEach(pt => {
            const px = (_marginL + pt[0] * _pxPerM).toFixed(1), py = (_ch - _marginB - pt[1] * _pxPerM).toFixed(1);
            svg += `<circle cx="${px}" cy="${py}" r="3" fill="${th.parcel}"/>
`;
        });
    }

    // Cartouche SVG
    const cartY = _ch - 70;
    svg += `<rect y="${cartY}" width="${_cw}" height="70" fill="${th.bg}" stroke="${th.frame}" stroke-width="2"/>
<text x="8" y="${cartY + 16}" font-family="Arial" font-size="11" font-weight="bold" fill="${th.label}">PLAN TOPOGRAPHIQUE</text>
<text x="8" y="${cartY + 32}" font-family="Arial" font-size="9" fill="${th.major}">Section ${p.section||'—'} n°${p.numero||'—'} — ${p.nom_com||p.commune||'—'}</text>
<text x="8" y="${cartY + 48}" font-family="Arial" font-size="8" fill="${th.minor}">Échelle 1:${_numScale} | Alt. ${zMin.toFixed(1)}m → ${zMax.toFixed(1)}m</text>
<text x="8" y="${cartY + 62}" font-family="Arial" font-size="7.5" fill="${th.minor}">Source : IGN RGE ALTI / Cadastre PCI Express | ${new Date().toLocaleDateString('fr-FR')} | topo3d-antilles.com</text>
`;

    svg += '</svg>';

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.download = `topo_${p.section||'X'}_${p.numero||'0'}_1-${_numScale}.svg`;
    a.href = URL.createObjectURL(blob);
    a.click();
}

// ═══ EXPORT PDF À L'ÉCHELLE (A4 paysage) ═══
async function downloadTopoPDF() {
    if (!topoData) { alert('Générez d\'abord le plan.'); return; }
    // Charger jsPDF dynamiquement si besoin
    if (typeof jspdf === 'undefined' && typeof jsPDF === 'undefined') {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
        document.head.appendChild(s);
        await new Promise((ok, fail) => { s.onload = ok; s.onerror = fail; });
    }
    const { jsPDF: JsPDF } = window.jspdf || window;
    const pdf = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }); // 297×210mm

    // Rendu du canvas en image
    const canvas = document.getElementById('topoCanvas');
    const imgData = canvas.toDataURL('image/png');

    // Calculer dimensions pour remplir la page avec marges
    const pageW = 297, pageH = 210, margin = 5;
    const drawableW = pageW - 2 * margin, drawableH = pageH - 2 * margin;
    const canvasRatio = canvas.width / canvas.height;
    let imgW, imgH;
    if (canvasRatio > drawableW / drawableH) {
        imgW = drawableW; imgH = drawableW / canvasRatio;
    } else {
        imgH = drawableH; imgW = drawableH * canvasRatio;
    }
    const offsetX = margin + (drawableW - imgW) / 2;
    const offsetY = margin + (drawableH - imgH) / 2;

    pdf.addImage(imgData, 'PNG', offsetX, offsetY, imgW, imgH);

    const p = selParc?.properties || {};
    pdf.save(`topo_${p.section||'X'}_${p.numero||'0'}_1-${topoData._numScale||'?'}_A4.pdf`);
}

// ═══════════════════════════════════════════════
// EXPORT SYSTEM
// ═══════════════════════════════════════════════
function requestExport(format) {
    if (!selParc) { alert('Sélectionnez d\'abord une parcelle.'); return; }
    if (!canExport(format)) { showUpgradePrompt(format); return; }
    const p = selParc.properties || {};
    const ref = `${p.section||'X'}_${p.numero||'0'}`;
    const com = p.nom_com || p.commune || '?';
    const layers = {
        terrain: document.getElementById('exp-terrain').checked,
        contours: document.getElementById('exp-contours').checked,
        parcelle: document.getElementById('exp-parcelle').checked,
        batiments: document.getElementById('exp-batiments').checked,
        points: document.getElementById('exp-points').checked,
    };

    // Client-side exports
    if (format === 'geojson') {
        const blob = new Blob([JSON.stringify(selParc, null, 2)], { type: 'application/geo+json' });
        downloadBlob(blob, `parcelle_${ref}.geojson`);
        return;
    }

    // Server-side exports (email command)
    if (['ifc','dwg','rvt','pln'].includes(format)) {
        const formatNames = { ifc: 'IFC (BIM)', dwg: 'DWG (AutoCAD + Bâtiments)', rvt: 'RVT (Projet Revit)', pln: 'PLN (Projet ArchiCAD)' };
        const layerList = Object.entries(layers).filter(([k,v]) => v).map(([k]) => k).join(', ');
        const subject = encodeURIComponent(`Export Topo3D ${formatNames[format]} — ${p.section} ${p.numero} ${com}`);
        const body = encodeURIComponent(
            `Bonjour,\n\n` +
            `Je souhaite un export au format ${formatNames[format]}.\n\n` +
            `Parcelle : ${p.section} ${p.numero}\n` +
            `Commune : ${com}\n` +
            `Surface : ${p.contenance||'?'} m²\n` +
            `Couches : ${layerList}\n\n` +
            `Format : ${format.toUpperCase()}\n\n` +
            (format === 'ifc' ? `Note : Format IFC 2x3/4 compatible Revit, ArchiCAD, Allplan, Vectorworks, BIMcollab.\n` : '') +
            (format === 'dwg' ? `Note : Inclure les bâtiments 3D (emprise OSM) dans le DWG si possible.\n` : '') +
            (format === 'rvt' ? `Note : Projet Revit avec topographie importée + familles de site. Merci de préciser la version Revit.\n` : '') +
            (format === 'pln' ? `Note : Projet ArchiCAD avec maillage terrain + contours. Merci de préciser la version ArchiCAD.\n` : '') +
            `\nMerci`
        );
        window.open(`mailto:contact@topo3d-antilles.com?subject=${subject}&body=${body}`, '_self');
        return;
    }

    // OBJ, DXF, STL — client-side generation via email for now
    // (full client-side generation would require the Python script backend)
    const formatNames = { obj: 'OBJ (Mesh 3D)', dxf: 'DXF (Courbes de niveau)', stl: 'STL (Impression 3D)' };
    const layerList = Object.entries(layers).filter(([k,v]) => v).map(([k]) => k).join(', ');
    const subject = encodeURIComponent(`Export Topo3D ${formatNames[format]} — ${p.section} ${p.numero} ${com}`);
    const body = encodeURIComponent(
        `Bonjour,\n\n` +
        `Je souhaite un export au format ${formatNames[format]}.\n\n` +
        `Parcelle : ${p.section} ${p.numero}\n` +
        `Commune : ${com}\n` +
        `Surface : ${p.contenance||'?'} m²\n` +
        `Couches demandées : ${layerList}\n\n` +
        `Merci`
    );
    window.open(`mailto:contact@topo3d-antilles.com?subject=${subject}&body=${body}`, '_self');
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Expose public API to window for HTML onclick handlers ───
Object.defineProperty(window, 'selParc', { get(){ return selParc; }, configurable: true });
Object.assign(window, {
    map,
    toggleSidebar, toggleRotate, switchIle,
    stab, clearSel, searchCad, searchAddr, searchGPS,
    toggleLayer, setStyle, go, goToPlanView, go3DView,
    toggleDrawMode, openTopoPlan, closeTopoPlan,
    requestExport, selOffer, order,
    generateTopoPlan, redrawTopoPlan,
    downloadTopoPNG, downloadTopoSVG, downloadTopoPDF
});

})(window, document);

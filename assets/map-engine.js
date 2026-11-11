/* AEROBOARD SimpleMap engine — self-contained raster map. No CDN or API keys.
   Implements only the Leaflet-like methods used by this EFB application. */
(() => {
  'use strict';
  const elem=(tag,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;return n};
  const xy=(loc)=>{if(Array.isArray(loc))return [Number(loc[1]),-Number(loc[0])];if(loc?.lat!==undefined)return [Number(loc.lng),-Number(loc.lat)];return [0,0]};
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const defaults={};
  class EngineMap {
    constructor(id){
      this.el=document.getElementById(id);this.el.classList.add('pf-map-engine');this.el.innerHTML='';
      this.root=elem('div','pf-map-world');this.el.append(this.root);
      this.scale=1;this.tx=0;this.ty=0;this.zoom=0;this.w=993;this.h=1299;this.mapEvents={};this.popup=null;
      this.pointerPositions=new Map();this.dragged=false;this.pinchDistance=0;this.lastPoint=null;
      const controls=elem('div','pf-map-controls');
      const plus=elem('button','pf-map-zoom');plus.type='button';plus.textContent='+';plus.ariaLabel='Zoom in';
      const minus=elem('button','pf-map-zoom');minus.type='button';minus.textContent='−';minus.ariaLabel='Zoom out';
      controls.append(plus,minus);this.el.append(controls);
      plus.addEventListener('click',e=>{e.stopPropagation();this.zoomAround(1.36,this.el.clientWidth/2,this.el.clientHeight/2)});
      minus.addEventListener('click',e=>{e.stopPropagation();this.zoomAround(1/1.36,this.el.clientWidth/2,this.el.clientHeight/2)});
      this.el.addEventListener('wheel',e=>{
        e.preventDefault();const rect=this.el.getBoundingClientRect();const factor=Math.exp(-clamp(e.deltaY,-180,180)*.0017);
        this.zoomAround(factor,e.clientX-rect.left,e.clientY-rect.top);
      },{passive:false});
      this.el.addEventListener('pointerdown',e=>{
        if(e.target.closest('.pf-pin,.pf-map-controls,.pf-popup'))return;
        this.closePopup();this.pointerPositions.set(e.pointerId,[e.clientX,e.clientY]);this.el.setPointerCapture(e.pointerId);
        this.lastPoint=[e.clientX,e.clientY];this.dragged=false;
        if(this.pointerPositions.size>1){const pp=[...this.pointerPositions.values()];this.pinchDistance=Math.hypot(pp[0][0]-pp[1][0],pp[0][1]-pp[1][1])}
      });
      this.el.addEventListener('pointermove',e=>{
        if(!this.pointerPositions.has(e.pointerId))return;
        const previous=this.pointerPositions.get(e.pointerId);
        this.pointerPositions.set(e.pointerId,[e.clientX,e.clientY]);
        if(this.pointerPositions.size===1){
          const dx=e.clientX-previous[0],dy=e.clientY-previous[1];
          if(dx||dy){this.tx+=dx;this.ty+=dy;this.dragged=true;this.render()}
        } else if(this.pointerPositions.size===2){
          const pairs=[...this.pointerPositions.values()],distance=Math.hypot(pairs[0][0]-pairs[1][0],pairs[0][1]-pairs[1][1]);
          const rect=this.el.getBoundingClientRect(),mid=[(pairs[0][0]+pairs[1][0])/2-rect.left,(pairs[0][1]+pairs[1][1])/2-rect.top];
          if(this.pinchDistance&&distance){this.zoomAround(clamp(distance/this.pinchDistance,.65,1.5),...mid);this.dragged=true}
          this.pinchDistance=distance;
        }
      });
      const done=e=>{if(this.pointerPositions.has(e.pointerId)){this.pointerPositions.delete(e.pointerId);this.pinchDistance=0;this.el.releasePointerCapture(e.pointerId)}};
      this.el.addEventListener('pointerup',done);this.el.addEventListener('pointercancel',done);
      this.el.addEventListener('click',e=>{
        if(this.dragged){this.dragged=false;return}
        if(e.target.closest('.pf-pin,.pf-popup,.pf-map-controls'))return;
        const rect=this.el.getBoundingClientRect(),xx=(e.clientX-rect.left-this.tx)/this.scale,yy=(e.clientY-rect.top-this.ty)/this.scale;
        (this.mapEvents.click||[]).forEach(fn=>fn({latlng:{lat:-yy,lng:xx},originalEvent:e}));
      });
    }
    render(){this.zoom=Math.log2(this.scale);this.root.style.transform=`translate3d(${this.tx}px,${this.ty}px,0) scale(${this.scale})`}
    setSize(w,h){this.w=w;this.h=h;this.root.style.width=w+'px';this.root.style.height=h+'px'}
    zoomAround(f,cx,cy){const next=clamp(this.scale*f,.08,8),rate=next/this.scale;this.tx=cx-(cx-this.tx)*rate;this.ty=cy-(cy-this.ty)*rate;this.scale=next;this.render()}
    invalidateSize(){this.render();return this}
    getZoom(){return this.zoom}
    setMaxBounds(){return this}
    on(name,fn){(this.mapEvents[name]??=[]).push(fn);return this}
    fitBounds(bounds,opts={}){
      const pairs=Array.isArray(bounds)?bounds:(bounds?.points||[]);if(!pairs.length)return this;
      const pts=pairs.map(xy),minX=Math.min(...pts.map(p=>p[0])),maxX=Math.max(...pts.map(p=>p[0])),minY=Math.min(...pts.map(p=>p[1])),maxY=Math.max(...pts.map(p=>p[1]));
      const pad=Array.isArray(opts.padding)?opts.padding:[16,16];const w=Math.max(1,this.el.clientWidth),h=Math.max(1,this.el.clientHeight);
      const next=clamp(Math.min((w-2*pad[0])/Math.max(1,maxX-minX),(h-2*pad[1])/Math.max(1,maxY-minY)),.08,8);
      this.scale=opts.maxZoom===undefined?next:Math.min(next,Math.pow(2,opts.maxZoom));
      this.tx=w/2-(minX+maxX)*.5*this.scale;this.ty=h/2-(minY+maxY)*.5*this.scale;
      this.render();return this;
    }
    setView(location,zoom){
      this.scale=clamp(Math.pow(2,zoom||0),.08,8);const p=xy(location);
      this.tx=this.el.clientWidth/2-p[0]*this.scale;this.ty=this.el.clientHeight/2-p[1]*this.scale;this.render();return this;
    }
    removeLayer(layer){layer.remove?.();return this}
    closePopup(){this.popup?.remove();this.popup=null;return this}
    attach(layer){layer.map=this;layer.mount();return this}
    openPopup(layer){this.closePopup();if(!layer.popup)return;const [x,y]=xy(layer.coord);
      const node=elem('div','pf-popup');node.append(layer.popup);this.el.append(node);
      const sx=this.tx+x*this.scale,sy=this.ty+y*this.scale;
      node.style.left=clamp(sx,85,Math.max(85,this.el.clientWidth-110))+'px';node.style.top=clamp(sy-19,85,Math.max(85,this.el.clientHeight-65))+'px';
      this.popup=node;
    }
  }
  class LayerGroup {
    constructor(){this.layers=[];this.map=null}
    addTo(map){this.map=map;return this}
    addLayer(l){this.layers.push(l);l.map=this.map;l.mount();return l}
    clearLayers(){this.layers.forEach(l=>l.remove());this.layers=[];this.map?.closePopup();return this}
  }
  class ImageLayer {
    constructor(url,bounds){this.url=url;this.bounds=bounds;this.node=null}
    addTo(map){this.map=map;this.mount();return this}
    mount(){const p=this.bounds.map(xy),w=Math.abs(p[1][0]-p[0][0]),h=Math.abs(p[1][1]-p[0][1]);this.map.setSize(w,h);
      const img=elem('img','pf-map-image');img.src=this.url;img.alt='Project Flight map illustration';img.draggable=false;
      img.style.width=w+'px';img.style.height=h+'px';this.map.root.prepend(img);this.node=img;
    }
    bringToBack(){if(this.node)this.map.root.prepend(this.node);return this}
    remove(){this.node?.remove()}
  }
  class Marker {
    constructor(coord,options={}){this.coord=coord;this.options=options;this.node=null;this.popup=null}
    addTo(target){if(target instanceof LayerGroup)return target.addLayer(this);this.map=target;this.mount();return this}
    mount(){if(!this.map)return;const [x,y]=xy(this.coord),node=elem('div','pf-pin');node.style.left=x+'px';node.style.top=y+'px';
      node.innerHTML=this.options.icon?.html||'<span class="pf-map-dot"></span>';
      this.map.root.append(node);this.node=node;node.addEventListener('click',e=>{e.stopPropagation();this.map.openPopup(this)});
      if(this.title)node.title=this.title;
    }
    bindTooltip(text){this.title=String(text);if(this.node)this.node.title=this.title;return this}
    bindPopup(node){this.popup=node;return this}
    remove(){this.node?.remove()}
  }
  class Polyline {
    constructor(points,opts={}){this.points=points;this.opts=opts}
    addTo(target){if(target instanceof LayerGroup)return target.addLayer(this);this.map=target;this.mount();return this}
    mount(){if(!this.map)return;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('pf-map-path');
      svg.setAttribute('viewBox',`0 0 ${this.map.w} ${this.map.h}`);svg.setAttribute('width',this.map.w);svg.setAttribute('height',this.map.h);
      const poly=document.createElementNS('http://www.w3.org/2000/svg','polyline');poly.setAttribute('points',this.points.map(p=>xy(p).join(',')).join(' '));poly.setAttribute('fill','none');
      poly.setAttribute('stroke',this.opts.color||'#68d8ff');poly.setAttribute('stroke-width',this.opts.weight||3);poly.setAttribute('stroke-opacity',this.opts.opacity??1);
      poly.setAttribute('stroke-linecap','round');poly.setAttribute('stroke-linejoin','round');poly.setAttribute('vector-effect','non-scaling-stroke');
      if(this.opts.dashArray)poly.setAttribute('stroke-dasharray',this.opts.dashArray.replaceAll(' ',''));
      svg.append(poly);this.map.root.append(svg);this.node=svg;
    }
    remove(){this.node?.remove()}
  }
  class CircleMarker {
    constructor(coord,opts={}){this.coord=coord;this.opts=opts}
    addTo(target){if(target instanceof LayerGroup)return target.addLayer(this);this.map=target;this.mount();return this}
    mount(){const [x,y]=xy(this.coord),el=elem('div','pf-pin pf-map-circle');el.style.left=x+'px';el.style.top=y+'px';
      el.style.width=(this.opts.radius||4)*2+'px';el.style.height=(this.opts.radius||4)*2+'px';el.style.background=this.opts.fillColor||'#ffad4d';
      el.style.border=`${this.opts.weight||1}px solid ${this.opts.color||'#fff'}`;this.map.root.append(el);this.node=el;
    }
    remove(){this.node?.remove()}
  }
  window.L={CRS:{Simple:{}},map:(id)=>new EngineMap(id),imageOverlay:(src,bounds)=>new ImageLayer(src,bounds),layerGroup:()=>new LayerGroup(),
    marker:(point,opts)=>new Marker(point,opts),divIcon:opts=>opts,polyline:(points,opts)=>new Polyline(points,opts),
    circleMarker:(p,opts)=>new CircleMarker(p,opts),latLngBounds:p=>p};
})();

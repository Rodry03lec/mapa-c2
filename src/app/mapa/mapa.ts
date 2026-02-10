import { Component, AfterViewInit } from '@angular/core';
import * as L from 'leaflet';

@Component({
  selector: 'app-mapa',
  templateUrl: './mapa.html',
  styleUrl: './mapa.scss',
})
export class Mapa implements AfterViewInit {

  // PROPIEDADES PRINCIPALES DEL MAPA

  // Instancia principal del mapa Leaflet
  private map!: L.Map;

  // CAPAS TEMÁTICAS POR AÑO

  // Capas originales (sin cortina)
  private capa2012!: L.LayerGroup;
  private capa2024!: L.LayerGroup;

  // CONFIGURACIÓN DE LA CORTINA COMPARATIVA

  // Nombre del pane exclusivo para la cortina
  private cortinaPaneName = 'cortinaPane';

  // Estado de la cortina
  private cortinaActiva = false;

  // Referencias a capas
  private capaOriginalRef: L.Layer | null = null; // capa real
  private capaClonRef: L.Layer | null = null;     // capa clonada

  // ELEMENTOS DEL SLIDER (DIVISOR)

  // Elemento HTML que actúa como divisor
  private dividerEl!: HTMLDivElement;

  // Posición actual del divisor (0–100%)
  private porcentajeDivider = 50;

  // Control de arrastre
  private isDragging = false;

  // Handlers para limpiar eventos
  private mouseMoveHandler!: (e: MouseEvent) => void;
  private mouseUpHandler!: () => void;

  // RENDERERS SVG POR PANE

  // Renderers SVG reutilizables por pane
  private _renderersPorPane = new Map<string, L.SVG>();

  // CICLO DE VIDA (ANGULAR)

  // Se ejecuta cuando el DOM ya existe
  ngAfterViewInit() {
    this.initMap();
  }

  // 7 INICIALIZACIÓN DEL MAPA
  private initMap() {

    // Crear mapa Leaflet
    this.map = L.map('map', {
      center: [-16.5, -65], // Bolivia
      zoom: 6
    });

    // Capa base OSM (no participa en la cortina)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
      .addTo(this.map);

    // Crear capas temáticas
    this.crearCapas();
  }

  // 8 CREACIÓN DE CAPAS POR AÑO
  private crearCapas() {

    // CAPA 2012
    this.capa2012 = L.layerGroup([
      L.circleMarker([-16.5, -68.15], {
        radius: 15,
        color: '#7f1d1d',
        fillColor: '#dc2626',
        fillOpacity: 0.8
      }).bindPopup('La Paz 2012'),

      L.circleMarker([-17.39, -66.15], {
        radius: 12,
        color: '#7f1d1d',
        fillColor: '#dc2626',
        fillOpacity: 0.8
      }).bindPopup('Cochabamba 2012')
    ]);

    // CAPA 2024
    this.capa2024 = L.layerGroup([
      L.circleMarker([-16.5, -68.15], {
        radius: 20,
        color: '#1e40af',
        fillColor: '#2563eb',
        fillOpacity: 0.8
      }).bindPopup('La Paz 2024'),

      L.circleMarker([-17.39, -66.15], {
        radius: 18,
        color: '#1e40af',
        fillColor: '#2563eb',
        fillOpacity: 0.8
      }).bindPopup('Cochabamba 2024')
    ]);

    // Mostrar capa inicial
    this.capa2012.addTo(this.map);
    this.capa2024.addTo(this.map);
  }

  // 9 APLICAR COMPARACIÓN ENTRE AÑOS
  aplicarComparacion(base: string, comparar: string) {

    if (base === comparar) {
      alert('Debe seleccionar años diferentes');
      return;
    }

    const capaBase = this.obtenerCapaPorAnio(base);
    const capaComparar = this.obtenerCapaPorAnio(comparar);

    if (!capaBase || !capaComparar) return;

    // Desactivar cortina previa (solo visual)
    this.desactivarCortina();

    // Asegurar que ambas capas estén visibles
    if (!this.map.hasLayer(capaBase)) {
      capaBase.addTo(this.map);
    }

    if (!this.map.hasLayer(capaComparar)) {
      capaComparar.addTo(this.map);
    }

    // Enviar SOLO la capa de comparación a la cortina
    this._activarCortinaConCapa(capaComparar);
  }

  private obtenerCapaPorAnio(anio: string): L.LayerGroup {
    return anio === '2012' ? this.capa2012 : this.capa2024;
  }


  //10 ACTIVAR CORTINA COMPARATIVA
  private _activarCortinaConCapa(layer: L.LayerGroup) {

    this._desactivarCortina();

    this.cortinaActiva = true;
    this.capaOriginalRef = layer;

    // OCULTAR LA CAPA ORIGINAL
    this.map.removeLayer(layer);

    // Crear pane exclusivo si no existe
    if (!this.map.getPane(this.cortinaPaneName)) {
      const pane = this.map.createPane(this.cortinaPaneName);
      pane.style.zIndex = '1000';
      pane.style.pointerEvents = 'none';
    }

    // Renderer SVG exclusivo
    const renderer = this._getOrCreateRenderer(this.cortinaPaneName);

    // Clonar capa con estilo exacto
    this.capaClonRef = this._clonarLayerVectorialConEstiloExacto(
      layer,
      this.cortinaPaneName,
      renderer
    );

    this.capaClonRef.addTo(this.map);

    // Crear divisor visual
    this._crearDividerCortina();

    // Aplicar clip inicial
    this._onMapChange();
  }

  private _getOrCreateRenderer(paneName: string): L.SVG {
    if (this._renderersPorPane.has(paneName)) {
      return this._renderersPorPane.get(paneName)!;
    }

    const renderer = L.svg({ pane: paneName });
    this._renderersPorPane.set(paneName, renderer);
    return renderer;
  }

  // 11 SLIDER / DIVISOR DE LA CORTINA
  private _crearDividerCortina() {

    this._removerDividerCortina();

    // Crear divisor
    this.dividerEl = document.createElement('div');
    this.dividerEl.style.cssText = `
      position:absolute;
      top:0;
      width:6px;
      height:100%;
      background:#1976d2;
      cursor:ew-resize;
      z-index:9999;
    `;

    this.map.getContainer().appendChild(this.dividerEl);

    // Iniciar arrastre
    const startDrag = () => {
      this.isDragging = true;
      this.map.dragging.disable();
    };

    // Mover divisor
    const moveDrag = (clientX: number) => {
      if (!this.isDragging) return;

      const rect = this.map.getContainer().getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const porcentaje = (x / rect.width) * 100;

      this.porcentajeDivider = porcentaje;
      this._aplicarClipSegunPosicion(porcentaje);
    };

    // Finalizar arrastre
    const endDrag = () => {
      this.isDragging = false;
      this.map.dragging.enable();
    };

    this.mouseMoveHandler = (e) => moveDrag(e.clientX);
    this.mouseUpHandler = () => endDrag();

    this.dividerEl.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', this.mouseMoveHandler);
    window.addEventListener('mouseup', this.mouseUpHandler);

    // Posición inicial
    this._aplicarClipSegunPosicion(50);
  }

  // 12 CLIP DE LA CORTINA
  private _aplicarClipSegunPosicion(porcentaje: number) {

    const pane = this.map.getPane(this.cortinaPaneName);
    if (!pane || !this.dividerEl) return;

    const rect = this.map.getContainer().getBoundingClientRect();
    const x = (porcentaje / 100) * rect.width;

    pane.style.clipPath = `polygon(
      0px 0px,
      ${x}px 0px,
      ${x}px ${rect.height}px,
      0px ${rect.height}px
    )`;

    (pane as any).style.webkitClipPath = pane.style.clipPath;

    this.dividerEl.style.left = `${x - this.dividerEl.offsetWidth / 2}px`;
    this.dividerEl.style.height = `${rect.height}px`;
  }

  // 13 CLONADO EXACTO DE CAPAS
  private _clonarLayerVectorialConEstiloExacto(
    group: L.LayerGroup,
    paneName: string,
    renderer: L.SVG
  ): L.LayerGroup {

    const clonGroup = L.layerGroup();

    group.eachLayer((child: any) => {
      if (child instanceof L.CircleMarker) {
        const clon = L.circleMarker(child.getLatLng(), {
          ...child.options,
          pane: paneName,
          renderer
        });
        clonGroup.addLayer(clon);
      }
    });

    return clonGroup;
  }

  // 14 DESACTIVAR CORTINA
  desactivarCortina() {
    this._desactivarCortina();
  }

  private _desactivarCortina() {

    if (!this.cortinaActiva) return;

    this.cortinaActiva = false;

    // Quitar clon
    if (this.capaClonRef)
      this.map.removeLayer(this.capaClonRef);

    // Restaurar capa original
    if (this.capaOriginalRef)
      this.map.addLayer(this.capaOriginalRef);

    this.capaOriginalRef = null;


    this._removerDividerCortina();
  }

  private _removerDividerCortina() {
    if (this.dividerEl) this.dividerEl.remove();
    this.isDragging = false;
  }

  private _onMapChange() {
    if (!this.cortinaActiva) return;
    this._aplicarClipSegunPosicion(this.porcentajeDivider);
  }
}

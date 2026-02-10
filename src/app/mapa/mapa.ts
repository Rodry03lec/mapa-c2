import { Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MenuItem } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { PanelMenuModule } from 'primeng/panelmenu';
import * as L from 'leaflet';

@Component({
  selector: 'app-mapa',
  imports: [ButtonModule, CardModule, PanelMenuModule],
  templateUrl: './mapa.html',
  styleUrl: './mapa.scss',
})
export class Mapa {
  private map!: L.Map;

  ngAfterViewInit(): void {
    this.initMap();
  }

  private initMap(): void {
    this.map = L.map('map', {
      center: [-16.5, -68.15], // Bolivia
      zoom: 13,
      zoomControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(this.map);
  }
}

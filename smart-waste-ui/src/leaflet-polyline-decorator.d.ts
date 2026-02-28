// Type declaration for leaflet-polylinedecorator
// This file provides TypeScript support for the leaflet-polylinedecorator plugin

import * as L from 'leaflet';

declare module 'leaflet' {
    function polylineDecorator(
        polyline: L.Polyline | L.LatLngExpression[],
        options?: any
    ): any;

    namespace Symbol {
        function arrowHead(options?: any): any;
        function dash(options?: any): any;
        function marker(options?: any): any;
    }
}
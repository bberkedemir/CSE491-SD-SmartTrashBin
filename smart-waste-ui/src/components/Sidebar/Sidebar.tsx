import React, { useState, useEffect, useRef } from 'react';
import type { RouteMetrics } from '../../types/bin';
import './Sidebar.css';

interface SidebarProps {
    isAddMode: boolean;
    onToggleAddMode: () => void;
    onUploadFile: () => void;
    isUploading: boolean;
    uploadProgress: number;
    isOptimizing: boolean;
    isRouteActive: boolean;
    onOptimizeRoute: () => void;
    onClearRoute: () => void;
    routeMetrics: RouteMetrics | null;
}

function getFillColor(fill: number): string {
    if (fill >= 80) return '#e74c3c';
    if (fill >= 50) return '#f39c12';
    return '#27ae60';
}

const Sidebar: React.FC<SidebarProps> = ({
    isAddMode,
    onToggleAddMode,
    onUploadFile,
    isUploading,
    uploadProgress,
    isOptimizing,
    isRouteActive,
    onOptimizeRoute,
    onClearRoute,
    routeMetrics,
}) => {
    const [showMetrics, setShowMetrics] = useState(false);
    const prevRouteActive = useRef(false);

    // Auto-show/hide metrics when route state changes
    useEffect(() => {
        if (isRouteActive && !prevRouteActive.current) {
            setTimeout(() => setShowMetrics(true), 300);
        }
        if (!isRouteActive && prevRouteActive.current) {
            setShowMetrics(false);
        }
        prevRouteActive.current = isRouteActive;
    }, [isRouteActive]);

    return (
        <div className="sidebar">
            <div className="sidebar-top">
                {/* Optimize/Clear Route Button */}
                <button
                    className={`sidebar-btn ${isRouteActive ? 'sidebar-btn--active-red' : 'sidebar-btn--purple'}`}
                    onClick={isRouteActive ? onClearRoute : onOptimizeRoute}
                    disabled={isOptimizing}
                    data-tooltip={isOptimizing ? 'Optimizing...' : isRouteActive ? 'Clear Route' : 'Optimize Route'}
                >
                    {isOptimizing ? (
                        <div className="sidebar-btn-spinner" />
                    ) : isRouteActive ? (
                        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>C</span>
                    ) : (
                        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>RO</span>
                    )}
                </button>

                {/* Add Marker Button */}
                <button
                    className={`sidebar-btn ${isAddMode ? 'sidebar-btn--active-red' : 'sidebar-btn--green'}`}
                    onClick={onToggleAddMode}
                    data-tooltip={isAddMode ? 'Cancel' : 'Add Marker'}
                >
                    {isAddMode ? (
                        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>C</span>
                    ) : (
                        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>A</span>
                    )}
                </button>

                {/* Upload JSON Button */}
                <button
                    className="sidebar-btn sidebar-btn--blue"
                    onClick={onUploadFile}
                    disabled={isUploading}
                    data-tooltip={isUploading ? `Uploading ${Math.round(uploadProgress)}%` : 'Upload Data'}
                >
                    {isUploading ? (
                        <div className="sidebar-btn-spinner" />
                    ) : (
                        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>U</span>
                    )}
                </button>
            </div>

            {/* Metrics Panel (Visible only when active route) */}
            {isRouteActive && routeMetrics && (
                <div className="sidebar-bottom">
                    <button
                        className="sidebar-btn sidebar-btn--ghost"
                        onClick={() => setShowMetrics(!showMetrics)}
                        data-tooltip={showMetrics ? 'Hide Metrics' : 'Show Metrics'}
                    >
                        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{showMetrics ? 'HM' : 'SM'}</span>
                    </button>

                    {showMetrics && (
                        <div className="sidebar-metrics">
                            <div className="sidebar-metrics-row">
                                <div className="sidebar-metrics-item">
                                    <div className="sidebar-metrics-value">{routeMetrics.totalDistanceKm.toFixed(1)}</div>
                                    <div className="sidebar-metrics-label">km</div>
                                </div>
                                <div className="sidebar-metrics-item">
                                    <div className="sidebar-metrics-value">{Math.round(routeMetrics.estimatedTimeMinutes)}</div>
                                    <div className="sidebar-metrics-label">min</div>
                                </div>
                                <div className="sidebar-metrics-item">
                                    <div className="sidebar-metrics-value">{routeMetrics.totalStops}</div>
                                    <div className="sidebar-metrics-label">stops</div>
                                </div>
                            </div>

                            <div className="sidebar-stops">
                                {routeMetrics.stops.map((stop, i) => (
                                    <div key={stop.id} className="sidebar-stop" data-tooltip={`${stop.title} (${stop.lat.toFixed(3)}, ${stop.lng.toFixed(3)})`}>
                                        <span
                                            className="sidebar-stop-num"
                                            style={{ backgroundColor: getFillColor(stop.fill_level) }}
                                        >
                                            {i + 1}
                                        </span>
                                        <span className="sidebar-stop-fill">{stop.fill_level}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Sidebar;

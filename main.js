// Mengambil modul dari objek global 'ol'
const Map = ol.Map;
const View = ol.View;
const TileLayer = ol.layer.Tile;
const VectorLayer = ol.layer.Vector;
const OSM = ol.source.OSM;
const VectorSource = ol.source.Vector;
const GeoJSON = ol.format.GeoJSON;
const fromLonLat = ol.proj.fromLonLat;
const { Icon, Style } = ol.style;
const Overlay = ol.Overlay;

// --- OPTIMASI 1: Style Cache ---
// Objek ini akan menyimpan style yang sudah dibuat agar tidak perlu dibuat ulang setiap frame
const styleCache = {};

// 1. Layer Polygon Riau (Dimodifikasi dengan Optimasi Cache)
const riau = new VectorLayer({
    source: new VectorSource({
        format: new GeoJSON({ featureProjection: 'EPSG:3857' }), 
        url: 'data/polygon_riau.json' 
    }),
    style: function(feature) {
        // Ambil FID
        const obj = feature.get('OBJECTID') || 0;
        
        // Cek apakah style untuk FID ini sudah ada di cache?
        // Jika sudah ada, langsung kembalikan (return) tanpa hitung ulang.
        if (styleCache[obj]) {
            return styleCache[obj];
        }

        // --- JIKA BELUM ADA, HITUNG BARU ---
        const minVal = 1;
        const maxVal = 1283;

        let ratio = (obj - minVal) / (maxVal - minVal);
        ratio = Math.max(0, Math.min(1, ratio));

        const r = Math.round(255 + (51 - 255) * ratio);
        const g = Math.round(255 + (88 - 255) * ratio);
        const b = Math.round(51 + (255 - 51) * ratio);
        
        // Buat style baru
        const newStyle = new Style({
            fill: new ol.style.Fill({
                color: `rgba(${r}, ${g}, ${b}, 0.7)`
            }),
            stroke: new ol.style.Stroke({
                color: '#666',
                width: 0.5
            })
        });

        // Simpan ke cache sebelum dikembalikan
        styleCache[obj] = newStyle;

        return newStyle;
    }
});

// 2. Layer Titik Penduduk
const penduduk = new VectorLayer({
    source: new VectorSource({
        format: new GeoJSON({ featureProjection: 'EPSG:3857' }),
        url: 'data/penduduk2.json' 
    }),
    style: new Style({
        image: new Icon({
            anchor: [0.5, 46],
            anchorXUnits: 'flaticon',
            anchorYUnits: 'pixels',
            src: 'https://cdn-icons-png.flaticon.com/512/2776/2776067.png', 
            width: 32,
            height: 32
        })
    })
});

// 3. Setup Popup Overlay
const container = document.getElementById('popup');
const content = document.getElementById('popup-content');
const closer = document.getElementById('popup-closer');

const popupOverlay = new Overlay({
    element: container,
    autoPan: {
        animation: { duration: 250 },
    },
    positioning: 'bottom-center',
    stopEvent: true,
    offset: [0, -40] 
});

// Fungsi Close Popup
closer.onclick = function (event) {
    event.preventDefault(); 
    popupOverlay.setPosition(undefined);
    closer.blur();
    return false;
};

// 4. Inisialisasi Map
const map = new Map({
    target: 'map',
    layers: [
        new TileLayer({
            source: new OSM(),
        }), 
        riau, 
        penduduk
    ],
    overlays: [popupOverlay],
    view: new View({
        center: fromLonLat([101.447779, 0.507068]), 
        zoom: 13,
    }),
});

// 5. Logika Klik untuk Popup
map.on('singleclick', function (evt) {
    const feature = map.forEachFeatureAtPixel(evt.pixel, function (feat) {
        return feat;
    });

    if (feature) {
        const coordinates = feature.getGeometry().getCoordinates();
        
        const alamat = feature.get('alamat') || 'Tanpa Nama';
        const jumlah = feature.get('jumlah_pen') || '0';
        const bahanBakar = feature.get('jenis_baha') || '-';
        const ventilasi = feature.get('ventilasi_') || '-';
        const gambarUrl = feature.get('gambar') || 'https://images.unsplash.com/photo-1580587771525-78b9dba3b91d?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80';

        const contentHtml = `
            <div class="card" style="width: 100%; border: none; overflow: hidden;">
                <img src="${gambarUrl}" class="card-img-top popup-card-img" style="height: 120px; object-fit: cover;" alt="Lokasi">
                <div class="card-body p-2">
                    <h6 class="card-title text-primary fw-bold mb-2">${alamat}</h6>
                    <div style="font-size: 0.9em;">
                        <p class="mb-1"><strong>Jumlah Penderita:</strong> ${jumlah}</p>
                        <p class="mb-1"><strong>Bahan Bakar:</strong> ${bahanBakar}</p>
                        <p class="mb-0"><strong>Ventilasi:</strong> ${ventilasi}</p>
                    </div>
                </div>
            </div>
        `;

        content.innerHTML = contentHtml;
        popupOverlay.setPosition(coordinates);
    } 
    else {
        popupOverlay.setPosition(undefined);
    }
});

// 6. Logika Hover Kursor
map.on('pointermove', function (evt) {
    if (evt.dragging) {
        return;
    }
    const pixel = map.getEventPixel(evt.originalEvent);
    const hit = map.hasFeatureAtPixel(pixel);
    map.getTargetElement().style.cursor = hit ? 'pointer' : '';
});

// 7. Event Listener Checkbox
const polygonLayerCheckbox = document.getElementById('polygon');
const pointLayerCheckbox = document.getElementById('point');

if (polygonLayerCheckbox) {
    polygonLayerCheckbox.addEventListener('change', function () {
        riau.setVisible(polygonLayerCheckbox.checked);
    });
}
if (pointLayerCheckbox) {
    pointLayerCheckbox.addEventListener('change', function () {
        penduduk.setVisible(pointLayerCheckbox.checked);
    });
}
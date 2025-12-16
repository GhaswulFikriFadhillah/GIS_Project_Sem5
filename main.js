// --- GLOBAL VARIABLES ---
let map;
let pendudukLayer, riauLayer, bufferLayer; // Tambah bufferLayer
let pendudukSource;

// --- DOM ELEMENTS ---
const landingPage = document.getElementById('landing-page');
const mapPage = document.getElementById('map-page');
const btnGetStarted = document.getElementById('btn-get-started');
const btnBackHome = document.getElementById('btn-back-home');

// --- NAVIGASI HALAMAN ---
btnGetStarted.addEventListener('click', () => {
    landingPage.classList.remove('active-section');
    landingPage.classList.add('hidden-section');
    mapPage.classList.remove('hidden-section');
    mapPage.classList.add('active-section');
    
    // Init map jika belum di-init (delay dikit biar transisi mulus)
    setTimeout(() => {
        if (!map) initMap();
        map.updateSize(); 
    }, 500);
});

btnBackHome.addEventListener('click', () => {
    mapPage.classList.remove('active-section');
    mapPage.classList.add('hidden-section');
    landingPage.classList.remove('hidden-section');
    landingPage.classList.add('active-section');
});

// --- LOGIKA PETA (OPENLAYERS) ---
function initMap() {
    // Setup Overlay Popup
    const container = document.getElementById('popup');
    const content = document.getElementById('popup-content');
    const closer = document.getElementById('popup-closer');

    const overlay = new ol.Overlay({
        element: container,
        autoPan: {
            animation: { duration: 250 }
        }
    });

    closer.onclick = function () {
        overlay.setPosition(undefined);
        closer.blur();
        return false;
    };

    // 1. Source Data
    
    // A. Data Penduduk
    pendudukSource = new ol.source.Vector({
        url: 'data/penduduk2.json',
        format: new ol.format.GeoJSON()
    });

    // LOGIKA FILTER: Hanya ambil 100 data (FID < 100)
    pendudukSource.on('featuresloadend', function() {
        const features = pendudukSource.getFeatures();
        // Loop backwards untuk aman saat menghapus
        for (let i = features.length - 1; i >= 0; i--) {
            const f = features[i];
            const fid = f.get('FID');
            // Hapus jika FID >= 100 (Jadi hanya sisa 0-99)
            if (fid >= 100) {
                pendudukSource.removeFeature(f);
            }
        }
        updateStats(); // Update statistik setelah filter selesai
    });

    // B. Data Polygon Riau
    const riauSource = new ol.source.Vector({
        url: 'data/polygon_riau.json',
        format: new ol.format.GeoJSON()
    });

    // C. Data Buffer (Baru - Placeholder)
    const bufferSource = new ol.source.Vector({
        url: 'buffer.json', // File menyusul, saat ini mungkin kosong/error 404 tidak masalah
        format: new ol.format.GeoJSON()
    });

    // 2. Styles
    const styleRiau = new ol.style.Style({
        stroke: new ol.style.Stroke({ color: '#3b82f6', width: 2 }),
        fill: new ol.style.Fill({ color: 'rgba(59, 130, 246, 0.1)' })
    });

    // Style Buffer (Warna oranye transparan standar buffer)
    const styleBuffer = new ol.style.Style({
        stroke: new ol.style.Stroke({ color: '#f59e0b', width: 2 }), 
        fill: new ol.style.Fill({ color: 'rgba(251, 191, 36, 0.3)' })
    });

    // Style Function untuk Titik (Dinamis berdasarkan filter)
    const stylePenduduk = function(feature) {
        const vent = feature.get('ventilasi_');
        
        let color = '#10b981'; // Default: Baik (Hijau)
        
        if (vent) {
            const vLower = vent.toLowerCase();
            // PERBAIKAN: Cek 'kurang' bukan 'buruk'
            if (vLower === 'kurang') {
                color = '#ef4444'; // Kurang (Merah)
            } else if (vLower === 'cukup') {
                color = '#eab308'; // Cukup (Kuning)
            }
        }
        
        return new ol.style.Style({
            image: new ol.style.Circle({
                radius: 6,
                fill: new ol.style.Fill({ color: color }),
                stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
            })
        });
    };

    // 3. Create Layers
    riauLayer = new ol.layer.Vector({
        source: riauSource,
        style: styleRiau
    });

    // Layer Buffer Baru
    bufferLayer = new ol.layer.Vector({
        source: bufferSource,
        style: styleBuffer
    });

    pendudukLayer = new ol.layer.Vector({
        source: pendudukSource,
        style: stylePenduduk
    });

    // 4. Create Map
    map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({ source: new ol.source.OSM() }),
            riauLayer,
            bufferLayer, // Letakkan di bawah titik penduduk
            pendudukLayer
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([101.447779, 0.533333]), 
            zoom: 13
        }),
        overlays: [overlay]
    });

    // 5. Interaksi Klik (Popup)
    map.on('singleclick', function (evt) {
        const feature = map.forEachFeatureAtPixel(evt.pixel, function (feat) {
            return feat;
        });

        // Pastikan popup HANYA muncul jika feature punya 'id_rumah' (Layer Penduduk)
        if (feature && feature.get('id_rumah')) {
            const coordinates = feature.getGeometry().getCoordinates();
            const props = feature.getProperties();

            // Mengambil nilai
            // data penduduk
            const kelurahan = props.kelurahan || '-';
            const idRumah = props.id_rumah || '-';
            const alamat = props.alamat || '-';
            const jumlahPen = props.jumlah_pen || 0;
            const jenisBaha = props.jenis_baha || '-';
            const ventilasi = props.ventilasi_ || '-';

            // Menentukan warna badge untuk popup
            let badgeColorClass = 'text-green-600';
            // PERBAIKAN: Cek 'kurang'
            if ((ventilasi || '').toLowerCase() === 'kurang') badgeColorClass = 'text-red-600';
            if ((ventilasi || '').toLowerCase() === 'cukup') badgeColorClass = 'text-yellow-600';

            // Template HTML Popup
            const html = `
                <div class="relative">
                    <div class="h-24 bg-blue-600 rounded-t-lg overflow-hidden relative">
                        <div class="absolute inset-0 bg-black/20"></div>
                        <div class="absolute bottom-2 left-3 text-white">
                            <h3 class="font-bold text-lg leading-tight">${kelurahan}</h3>
                            <p class="text-xs opacity-90">${idRumah}</p>
                        </div>
                        <i class="fa-solid fa-house-medical absolute top-3 right-3 text-white/30 text-4xl"></i>
                    </div>
                    <div class="p-4">
                        <p class="text-gray-600 text-sm mb-3 border-b pb-2">
                            <i class="fa-solid fa-location-dot mr-2 text-blue-500"></i>${alamat}
                        </p>
                        <div class="grid grid-cols-2 gap-2 text-sm">
                            <div class="bg-gray-50 p-2 rounded border border-gray-100">
                                <p class="text-xs text-gray-500">Penderita</p>
                                <p class="font-bold text-gray-800">${jumlahPen} Orang</p>
                            </div>
                            <div class="bg-gray-50 p-2 rounded border border-gray-100">
                                <p class="text-xs text-gray-500">Bahan Bakar</p>
                                <p class="font-bold text-gray-800 capitalize">${jenisBaha}</p>
                            </div>
                            <div class="col-span-2 bg-gray-50 p-2 rounded border border-gray-100">
                                <p class="text-xs text-gray-500">Ventilasi</p>
                                <p class="font-bold capitalize ${badgeColorClass}">
                                    ${ventilasi}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            content.innerHTML = html;
            overlay.setPosition(coordinates);
        } else {
            overlay.setPosition(undefined);
        }
    });

    // Cursor pointer saat hover (Hanya ubah kursor jika kena titik penduduk)
    map.on('pointermove', function (e) {
        if (e.dragging) return;
        const pixel = map.getEventPixel(e.originalEvent);
        const feature = map.forEachFeatureAtPixel(pixel, function(feature) {
            return feature;
        });
        
        // Cek jika feature ada DAN feature tersebut adalah titik penduduk
        const hitPenduduk = feature && feature.get('id_rumah');
        map.getTargetElement().style.cursor = hitPenduduk ? 'pointer' : '';
    });
}

// --- CONTROL PANEL LOGIC ---

// 1. Layer Toggles
document.getElementById('check-polygon').addEventListener('change', (e) => {
    riauLayer.setVisible(e.target.checked);
});
document.getElementById('check-points').addEventListener('change', (e) => {
    pendudukLayer.setVisible(e.target.checked);
});

// Listener untuk Checkbox Buffer
const checkBuffer = document.getElementById('check-buffer');
if (checkBuffer) {
    checkBuffer.addEventListener('change', (e) => {
        bufferLayer.setVisible(e.target.checked);
    });
}

// 2. Filtering Logic
const filterVent = document.getElementById('filter-ventilasi');
const filterBB = document.getElementById('filter-bb');
const btnReset = document.getElementById('btn-reset');

function applyFilter() {
    const ventValue = filterVent.value.toLowerCase();
    const bbValue = filterBB.value.toLowerCase();

    // MAPPING VALUE: Jika HTML mengirim 'buruk', kita cari 'kurang' di data
    let searchVent = ventValue;
    if (searchVent === 'buruk') searchVent = 'kurang';

    // Style function yang dinamis untuk filtering
    pendudukLayer.setStyle(function(feature) {
        const fVent = (feature.get('ventilasi_') || '').toLowerCase();
        const fBaha = (feature.get('jenis_baha') || '').toLowerCase();

        let matchVent = (ventValue === 'all') || (fVent.includes(searchVent));
        let matchBB = (bbValue === 'all') || (fBaha.includes(bbValue));

        if (matchVent && matchBB) {
            // Logika Warna Filter
            let color = '#10b981'; // Default (Baik)
            if (fVent === 'kurang') color = '#ef4444'; // Kurang = Merah
            else if (fVent === 'cukup') color = '#eab308'; // Cukup = Kuning

            return new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 6,
                    fill: new ol.style.Fill({ color: color }),
                    stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
                })
            });
        } else {
            return null; // Hide
        }
    });
    
    setTimeout(updateStats, 100);
}

filterVent.addEventListener('change', applyFilter);
filterBB.addEventListener('change', applyFilter);

btnReset.addEventListener('click', () => {
    filterVent.value = 'all';
    filterBB.value = 'all';
    applyFilter();
});

// 3. Update Statistik
function updateStats() {
    if (!pendudukSource) {
        document.getElementById('total-points').innerText = "0";
        return;
    }
    
    const ventValue = filterVent.value.toLowerCase();
    const bbValue = filterBB.value.toLowerCase();

    // MAPPING VALUE di Stats juga
    let searchVent = ventValue;
    if (searchVent === 'buruk') searchVent = 'kurang';
    
    const features = pendudukSource.getFeatures();
    let count = 0;

    features.forEach(f => {
        const fVent = (f.get('ventilasi_') || '').toLowerCase();
        const fBaha = (f.get('jenis_baha') || '').toLowerCase();
        
        let matchVent = (ventValue === 'all') || (fVent.includes(searchVent));
        let matchBB = (bbValue === 'all') || (fBaha.includes(bbValue));
        
        if(matchVent && matchBB) count++;
    });

    const el = document.getElementById('total-points');
    el.innerText = count;
}
## 2 Related Work

Indoor pedestrian wayfinding has been approached in three ways:
- tracking the phone visually and inertially
- installing radio infrastructure in the building
- placing markers in the environment

We review each with attention to what it costs to deploy in a large public building such as a transit station. We then place this work within research on transit passenger wayfinding.

### 2.1 Visual-inertial AR navigation

Mobile AR frameworks such as ARCore and ARKit track the phone with visual-inertial simultaneous localisation and mapping (SLAM). Google's Indoor Live View uses this kind of tracking, together with localisation against previously captured imagery, to overlay directions in selected airports, malls and transit stations [@cnbc2021liveview].

In small, static spaces the tracking is accurate. Morar et al. measured a mean position error of 0.16 m for ARCore against an HTC Vive reference [@morar2020arcore], and Marino et al. benchmarked the built-in tracking of eight current phones and tablets for indoor AR [@marino2022benchmarking].

At building scale the picture changes. In a 1,600 m² industrial hall with long walks and changing surroundings, Feigl et al. found that ARCore, ARKit and HoloLens accumulated about 17 m of error per 120 m walked. They concluded that, out of the box, these systems were not usable for that setting [@feigl2020localization].

These approaches need a native application or a supported device, and some need prior visual mapping of the venue. Their tracking is least reliable in exactly the conditions of a busy station concourse: long distances, crowds and repetitive, low-texture surfaces.

Our system does not track position continuously. It needs only a web browser, and it needs only the phone's heading between known points.

### 2.2 Infrastructure-based positioning

Radio-based indoor positioning ranges from Wi-Fi fingerprinting, beginning with RADAR [@bahl2000radar], to Bluetooth Low Energy (BLE) beacons and ultra-wideband (UWB) ranging; Zafari et al. survey the field [@zafari2019survey].

Accuracy depends directly on how much infrastructure is installed. In Faragher and Harle's BLE fingerprinting study, 95% of one-shot position errors were below 2.6 m with one beacon per 30 m², below 4.8 m with one beacon per 100 m², and below 8.5 m using the building's existing Wi-Fi network [@faragher2015ble]. UWB reaches decimetre-level accuracy but needs dedicated anchors and tags [@alarifi2016uwb].

For an operator, these systems carry three kinds of cost:
- **capital:** hardware roughly proportional to floor area
- **operating:** battery replacement and recalibration
- **survey effort:** collecting fingerprints, and collecting them again after the layout changes

All three are repeated at every site. A printed anchor, by contrast, costs only printing and lamination and needs no power. Its cost at a site is set by how many anchors are needed, and that number depends on the density requirement measured in this paper. Section [X] compares the deployment costs directly.

### 2.3 Marker-based positioning and magnetometer heading

Markers placed in the environment are an established way to give a phone an absolute position, and we do not claim that mechanism as new.
- Mulloni et al. used fiducial markers read by camera phones for indoor positioning and navigation [@mulloni2009indoor].
- Basiri et al. examined QR codes as landmarks for landmark-based pedestrian navigation [@basiri2014qr].
- Several systems use QR codes to correct pedestrian dead reckoning (PDR). Chirakkal et al. combined inertial sensing with QR codes and report 0.64 m accuracy [@chirakkal2015qr]. Nowicki added QR-code observations as constraints in a graph-based fusion of PDR and Wi-Fi fingerprints [@nowicki2016qr].
- UnLoc generalised the idea to landmarks the environment already offers, which reset dead-reckoning error as the user passes them [@wang2012unloc].
- Sood and Mahato combined QR codes with AR guidance for indoor navigation [@sood2022qrar].
- For mobile robots, Bach et al. measured how localisation error grows as QR codes are placed further apart [@bach2023qr].

The weakness that markers compensate for is also well documented. Afzal et al. showed that man-made structures perturb the magnetic field in pedestrian environments, which limits magnetometer heading [@afzal2011magnetic]. Ettlinger et al. observed heading deviations of up to 25° near magnetic anomalies, and report a 17.4° RMS heading error for their own robust filter in a laboratory trial [@ettlinger2024robust]. Bowers measured compass deviation curves on 17 mobile devices running AR compass apps and found deviations typically of 5–10° [@bowers2022compass].

This literature establishes two things: markers can reset a pedestrian's position, and smartphone magnetometer heading is unreliable indoors. What we did not find is a pedestrian anchor-spacing requirement derived from measured heading error as a function of distance walked since the last reset.

We also did not find such measurements for the heading a web page receives through the W3C Device Orientation API [@w3c2025orientation]. That heading is relative to an arbitrary start on some browsers and to magnetic north on others, and on iOS it is only available after an explicit permission request. Measuring this error and turning it into an anchor-spacing bound is the contribution of this paper.

### 2.4 Transit passenger wayfinding

Wayfinding research in metro stations has mostly studied fixed signage. For example, Hu and Xu's virtual-reality experiment found that combining vertical and horizontal signs gave the best passenger wayfinding performance [@hu2023signage].

Digital aids such as Indoor Live View have reached only a small number of large venues [@cnbc2021liveview]. A zero-install aid that relies on printed anchors would complement a station's signage rather than replace it. For operators to adopt it across a network, its deployment cost has to be comparable to that of signage.

<!-- TODO: add 2–3 more transit sources (passenger information systems; Indian metro context) — see literature-notes.md -->

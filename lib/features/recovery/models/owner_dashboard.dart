import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:pawtag/features/recovery/models/pawtag_profile.dart';
import 'package:pawtag/features/dashboard/location_provider.dart';

class OwnerDashboardScreen extends ConsumerWidget {
  final PawTagProfile profile;

  const OwnerDashboardScreen({super.key, required this.profile});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locationState = ref.watch(locationProvider);

    LatLng initialPos = const LatLng(-36.8485, 174.7633);
    if (locationState.locationHistory.isNotEmpty) {
      final latest = locationState.locationHistory.last;
      initialPos = LatLng(latest.latitude, latest.longitude);
    }

    final Set<Marker> markers = {
      Marker(
        markerId: const MarkerId('pet_marker_default'),
        position: const LatLng(-36.8485, 174.7633),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
      ),
      ...locationState.locationHistory.map((loc) => Marker(
            markerId: MarkerId(loc.timestamp),
            position: LatLng(loc.latitude, loc.longitude),
            icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
            infoWindow: InfoWindow(title: loc.source, snippet: loc.timestamp),
          )),
    };

    return Scaffold(
      appBar: AppBar(title: const Text('PawTag - My Pet')),
      body: Column(
        children: [
          Card(
            margin: const EdgeInsets.all(16.0),
            elevation: 4,
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 40,
                    backgroundImage: NetworkImage(profile.photoUrl),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          profile.petName,
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        Text('Tag ID: ${profile.tagId}'),
                        if (profile.medicalAlerts.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 4.0),
                            child: Text(
                              'Alert: ${profile.medicalAlerts}',
                              style: const TextStyle(color: Colors.red),
                            ),
                          ),
                      ],
                    ),
                  ),
                  Column(
                    children: [
                      Icon(
                        profile.isLost ? Icons.warning : Icons.check_circle,
                        color: profile.isLost ? Colors.red : Colors.green,
                        size: 32,
                      ),
                      Text(
                        profile.isLost ? 'Missing' : 'Safe',
                        style: TextStyle(
                          color: profile.isLost ? Colors.red : Colors.green,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: ElevatedButton.icon(
              onPressed: () async {
                final locationUpdate = await scanQRCode(); 
                if (locationUpdate != null) {
                  ref.read(locationProvider.notifier).onLocationUpdate(locationUpdate);
                }
              },
              icon: const Icon(Icons.qr_code_scanner),
              label: const Text('Scan QR Code'),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(double.infinity, 50),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: GoogleMap(
              initialCameraPosition: CameraPosition(
                target: initialPos,
                zoom: 12,
              ),
              onMapCreated: (GoogleMapController controller) {},
              markers: markers,
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          ref.read(locationProvider.notifier).startLocationTracking();
        },
        child: const Icon(Icons.location_searching),
      ),
    );
  }

  Future<String?> scanQRCode() async {
    // Implement the QR code scanning logic here 
    // This currently simulates a detected coordinate JSON from a QR payload
    return '{"latitude": -36.8400, "longitude": 174.7600}';
  }
}

import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:pawtag/features/recovery/models/location_event.dart';
import 'package:pawtag/utils/geolocator_service.dart';
import 'package:pawtag/utils/find_my_service_android.dart';
import 'package:pawtag/utils/find_my_service_ios.dart';

part 'location_provider.freezed.dart';

@freezed
abstract class LocationState with _$LocationState {
  const factory LocationState({
    required List<LocationEvent> locationHistory,
  }) = _LocationState;

  factory LocationState.initial() => const LocationState(locationHistory: []);
}

class LocationNotifier extends Notifier<LocationState> {
  late final GeolocatorService geolocatorService;
  late final FindMyServiceAndroid findMyServiceAndroid;
  late final FindMyServiceIOS findMyServiceiOS;

  @override
  LocationState build() {
    geolocatorService = GeolocatorService();
    findMyServiceAndroid = FindMyServiceAndroid();
    findMyServiceiOS = FindMyServiceIOS();

    if (!kIsWeb) {
      if (defaultTargetPlatform == TargetPlatform.android) {
        FindMyServiceAndroid.setLocationUpdateListener(onLocationUpdate);
      } else if (defaultTargetPlatform == TargetPlatform.iOS) {
        FindMyServiceIOS.setLocationUpdateListener(onLocationUpdate);
      }
    }

    return LocationState.initial();
  }

  Future<void> startLocationTracking() async {
    if (!kIsWeb) {
      if (defaultTargetPlatform == TargetPlatform.iOS) {
        await findMyServiceiOS.startLocationTracking();
      } else if (defaultTargetPlatform == TargetPlatform.android) {
        await findMyServiceAndroid.startLocationTracking();
      }
    }

    await geolocatorService.requestPermission();
    final location = await geolocatorService.getCurrentPosition();

    state = state.copyWith(
      locationHistory: [
        ...state.locationHistory,
        LocationEvent(
          timestamp: DateTime.now().toIso8601String(),
          latitude: location.latitude,
          longitude: location.longitude,
          source: 'BLE',
        ),
      ],
    );
  }

  void onLocationUpdate(String locationData) {
    try {
      final data = jsonDecode(locationData);
      state = state.copyWith(
        locationHistory: [
          ...state.locationHistory,
          LocationEvent(
            timestamp: DateTime.now().toIso8601String(),
            latitude: (data['latitude'] as num).toDouble(),
            longitude: (data['longitude'] as num).toDouble(),
            source: 'QR Scan / Platform',
          ),
        ],
      );
    } catch (e) {
      print('Failed to parse location data: $e');
    }
  }
}

final locationProvider = NotifierProvider<LocationNotifier, LocationState>(() {
  return LocationNotifier();
});

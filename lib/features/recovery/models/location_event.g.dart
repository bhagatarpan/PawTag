// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'location_event.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_LocationEvent _$LocationEventFromJson(Map<String, dynamic> json) =>
    _LocationEvent(
      timestamp: json['timestamp'] as String,
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      source: json['source'] as String,
    );

Map<String, dynamic> _$LocationEventToJson(_LocationEvent instance) =>
    <String, dynamic>{
      'timestamp': instance.timestamp,
      'latitude': instance.latitude,
      'longitude': instance.longitude,
      'source': instance.source,
    };

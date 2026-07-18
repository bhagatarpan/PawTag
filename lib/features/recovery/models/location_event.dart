import 'package:freezed_annotation/freezed_annotation.dart';

part 'location_event.freezed.dart';
part 'location_event.g.dart';

@freezed
abstract class LocationEvent with _$LocationEvent {
  const factory LocationEvent({
    required String timestamp,
    required double latitude,
    required double longitude,
    required String source,
  }) = _LocationEvent;

  factory LocationEvent.fromJson(Map<String, dynamic> json) =>
      _$LocationEventFromJson(json);
}

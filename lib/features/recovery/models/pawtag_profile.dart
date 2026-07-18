import 'package:freezed_annotation/freezed_annotation.dart';

part 'pawtag_profile.freezed.dart';
part 'pawtag_profile.g.dart';

@freezed
abstract class PawTagProfile with _$PawTagProfile {
  const factory PawTagProfile({
    required String tagId,
    required String petName,
    required String photoUrl,
    required String medicalAlerts,
    @Default(false) bool isLost,
  }) = _PawTagProfile;

  factory PawTagProfile.fromJson(Map<String, dynamic> json) => _$PawTagProfileFromJson(json);
}

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pawtag_profile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PawTagProfile _$PawTagProfileFromJson(Map<String, dynamic> json) =>
    _PawTagProfile(
      tagId: json['tagId'] as String,
      petName: json['petName'] as String,
      photoUrl: json['photoUrl'] as String,
      medicalAlerts: json['medicalAlerts'] as String,
      isLost: json['isLost'] as bool? ?? false,
    );

Map<String, dynamic> _$PawTagProfileToJson(_PawTagProfile instance) =>
    <String, dynamic>{
      'tagId': instance.tagId,
      'petName': instance.petName,
      'photoUrl': instance.photoUrl,
      'medicalAlerts': instance.medicalAlerts,
      'isLost': instance.isLost,
    };

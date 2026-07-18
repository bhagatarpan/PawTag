// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'pawtag_profile.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PawTagProfile {

 String get tagId; String get petName; String get photoUrl; String get medicalAlerts; bool get isLost;
/// Create a copy of PawTagProfile
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PawTagProfileCopyWith<PawTagProfile> get copyWith => _$PawTagProfileCopyWithImpl<PawTagProfile>(this as PawTagProfile, _$identity);

  /// Serializes this PawTagProfile to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PawTagProfile&&(identical(other.tagId, tagId) || other.tagId == tagId)&&(identical(other.petName, petName) || other.petName == petName)&&(identical(other.photoUrl, photoUrl) || other.photoUrl == photoUrl)&&(identical(other.medicalAlerts, medicalAlerts) || other.medicalAlerts == medicalAlerts)&&(identical(other.isLost, isLost) || other.isLost == isLost));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,tagId,petName,photoUrl,medicalAlerts,isLost);

@override
String toString() {
  return 'PawTagProfile(tagId: $tagId, petName: $petName, photoUrl: $photoUrl, medicalAlerts: $medicalAlerts, isLost: $isLost)';
}


}

/// @nodoc
abstract mixin class $PawTagProfileCopyWith<$Res>  {
  factory $PawTagProfileCopyWith(PawTagProfile value, $Res Function(PawTagProfile) _then) = _$PawTagProfileCopyWithImpl;
@useResult
$Res call({
 String tagId, String petName, String photoUrl, String medicalAlerts, bool isLost
});




}
/// @nodoc
class _$PawTagProfileCopyWithImpl<$Res>
    implements $PawTagProfileCopyWith<$Res> {
  _$PawTagProfileCopyWithImpl(this._self, this._then);

  final PawTagProfile _self;
  final $Res Function(PawTagProfile) _then;

/// Create a copy of PawTagProfile
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? tagId = null,Object? petName = null,Object? photoUrl = null,Object? medicalAlerts = null,Object? isLost = null,}) {
  return _then(_self.copyWith(
tagId: null == tagId ? _self.tagId : tagId // ignore: cast_nullable_to_non_nullable
as String,petName: null == petName ? _self.petName : petName // ignore: cast_nullable_to_non_nullable
as String,photoUrl: null == photoUrl ? _self.photoUrl : photoUrl // ignore: cast_nullable_to_non_nullable
as String,medicalAlerts: null == medicalAlerts ? _self.medicalAlerts : medicalAlerts // ignore: cast_nullable_to_non_nullable
as String,isLost: null == isLost ? _self.isLost : isLost // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [PawTagProfile].
extension PawTagProfilePatterns on PawTagProfile {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PawTagProfile value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PawTagProfile() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PawTagProfile value)  $default,){
final _that = this;
switch (_that) {
case _PawTagProfile():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PawTagProfile value)?  $default,){
final _that = this;
switch (_that) {
case _PawTagProfile() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String tagId,  String petName,  String photoUrl,  String medicalAlerts,  bool isLost)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PawTagProfile() when $default != null:
return $default(_that.tagId,_that.petName,_that.photoUrl,_that.medicalAlerts,_that.isLost);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String tagId,  String petName,  String photoUrl,  String medicalAlerts,  bool isLost)  $default,) {final _that = this;
switch (_that) {
case _PawTagProfile():
return $default(_that.tagId,_that.petName,_that.photoUrl,_that.medicalAlerts,_that.isLost);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String tagId,  String petName,  String photoUrl,  String medicalAlerts,  bool isLost)?  $default,) {final _that = this;
switch (_that) {
case _PawTagProfile() when $default != null:
return $default(_that.tagId,_that.petName,_that.photoUrl,_that.medicalAlerts,_that.isLost);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PawTagProfile implements PawTagProfile {
  const _PawTagProfile({required this.tagId, required this.petName, required this.photoUrl, required this.medicalAlerts, this.isLost = false});
  factory _PawTagProfile.fromJson(Map<String, dynamic> json) => _$PawTagProfileFromJson(json);

@override final  String tagId;
@override final  String petName;
@override final  String photoUrl;
@override final  String medicalAlerts;
@override@JsonKey() final  bool isLost;

/// Create a copy of PawTagProfile
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PawTagProfileCopyWith<_PawTagProfile> get copyWith => __$PawTagProfileCopyWithImpl<_PawTagProfile>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PawTagProfileToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PawTagProfile&&(identical(other.tagId, tagId) || other.tagId == tagId)&&(identical(other.petName, petName) || other.petName == petName)&&(identical(other.photoUrl, photoUrl) || other.photoUrl == photoUrl)&&(identical(other.medicalAlerts, medicalAlerts) || other.medicalAlerts == medicalAlerts)&&(identical(other.isLost, isLost) || other.isLost == isLost));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,tagId,petName,photoUrl,medicalAlerts,isLost);

@override
String toString() {
  return 'PawTagProfile(tagId: $tagId, petName: $petName, photoUrl: $photoUrl, medicalAlerts: $medicalAlerts, isLost: $isLost)';
}


}

/// @nodoc
abstract mixin class _$PawTagProfileCopyWith<$Res> implements $PawTagProfileCopyWith<$Res> {
  factory _$PawTagProfileCopyWith(_PawTagProfile value, $Res Function(_PawTagProfile) _then) = __$PawTagProfileCopyWithImpl;
@override @useResult
$Res call({
 String tagId, String petName, String photoUrl, String medicalAlerts, bool isLost
});




}
/// @nodoc
class __$PawTagProfileCopyWithImpl<$Res>
    implements _$PawTagProfileCopyWith<$Res> {
  __$PawTagProfileCopyWithImpl(this._self, this._then);

  final _PawTagProfile _self;
  final $Res Function(_PawTagProfile) _then;

/// Create a copy of PawTagProfile
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? tagId = null,Object? petName = null,Object? photoUrl = null,Object? medicalAlerts = null,Object? isLost = null,}) {
  return _then(_PawTagProfile(
tagId: null == tagId ? _self.tagId : tagId // ignore: cast_nullable_to_non_nullable
as String,petName: null == petName ? _self.petName : petName // ignore: cast_nullable_to_non_nullable
as String,photoUrl: null == photoUrl ? _self.photoUrl : photoUrl // ignore: cast_nullable_to_non_nullable
as String,medicalAlerts: null == medicalAlerts ? _self.medicalAlerts : medicalAlerts // ignore: cast_nullable_to_non_nullable
as String,isLost: null == isLost ? _self.isLost : isLost // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on

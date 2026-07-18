// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'finder_portal.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FinderPortal {

 PawTagProfile get profile;
/// Create a copy of FinderPortal
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FinderPortalCopyWith<FinderPortal> get copyWith => _$FinderPortalCopyWithImpl<FinderPortal>(this as FinderPortal, _$identity);

  /// Serializes this FinderPortal to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FinderPortal&&(identical(other.profile, profile) || other.profile == profile));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,profile);

@override
String toString() {
  return 'FinderPortal(profile: $profile)';
}


}

/// @nodoc
abstract mixin class $FinderPortalCopyWith<$Res>  {
  factory $FinderPortalCopyWith(FinderPortal value, $Res Function(FinderPortal) _then) = _$FinderPortalCopyWithImpl;
@useResult
$Res call({
 PawTagProfile profile
});


$PawTagProfileCopyWith<$Res> get profile;

}
/// @nodoc
class _$FinderPortalCopyWithImpl<$Res>
    implements $FinderPortalCopyWith<$Res> {
  _$FinderPortalCopyWithImpl(this._self, this._then);

  final FinderPortal _self;
  final $Res Function(FinderPortal) _then;

/// Create a copy of FinderPortal
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? profile = null,}) {
  return _then(_self.copyWith(
profile: null == profile ? _self.profile : profile // ignore: cast_nullable_to_non_nullable
as PawTagProfile,
  ));
}
/// Create a copy of FinderPortal
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PawTagProfileCopyWith<$Res> get profile {
  
  return $PawTagProfileCopyWith<$Res>(_self.profile, (value) {
    return _then(_self.copyWith(profile: value));
  });
}
}


/// Adds pattern-matching-related methods to [FinderPortal].
extension FinderPortalPatterns on FinderPortal {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FinderPortal value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FinderPortal() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FinderPortal value)  $default,){
final _that = this;
switch (_that) {
case _FinderPortal():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FinderPortal value)?  $default,){
final _that = this;
switch (_that) {
case _FinderPortal() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( PawTagProfile profile)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FinderPortal() when $default != null:
return $default(_that.profile);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( PawTagProfile profile)  $default,) {final _that = this;
switch (_that) {
case _FinderPortal():
return $default(_that.profile);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( PawTagProfile profile)?  $default,) {final _that = this;
switch (_that) {
case _FinderPortal() when $default != null:
return $default(_that.profile);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FinderPortal implements FinderPortal {
  const _FinderPortal({required this.profile});
  factory _FinderPortal.fromJson(Map<String, dynamic> json) => _$FinderPortalFromJson(json);

@override final  PawTagProfile profile;

/// Create a copy of FinderPortal
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FinderPortalCopyWith<_FinderPortal> get copyWith => __$FinderPortalCopyWithImpl<_FinderPortal>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FinderPortalToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FinderPortal&&(identical(other.profile, profile) || other.profile == profile));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,profile);

@override
String toString() {
  return 'FinderPortal(profile: $profile)';
}


}

/// @nodoc
abstract mixin class _$FinderPortalCopyWith<$Res> implements $FinderPortalCopyWith<$Res> {
  factory _$FinderPortalCopyWith(_FinderPortal value, $Res Function(_FinderPortal) _then) = __$FinderPortalCopyWithImpl;
@override @useResult
$Res call({
 PawTagProfile profile
});


@override $PawTagProfileCopyWith<$Res> get profile;

}
/// @nodoc
class __$FinderPortalCopyWithImpl<$Res>
    implements _$FinderPortalCopyWith<$Res> {
  __$FinderPortalCopyWithImpl(this._self, this._then);

  final _FinderPortal _self;
  final $Res Function(_FinderPortal) _then;

/// Create a copy of FinderPortal
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? profile = null,}) {
  return _then(_FinderPortal(
profile: null == profile ? _self.profile : profile // ignore: cast_nullable_to_non_nullable
as PawTagProfile,
  ));
}

/// Create a copy of FinderPortal
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PawTagProfileCopyWith<$Res> get profile {
  
  return $PawTagProfileCopyWith<$Res>(_self.profile, (value) {
    return _then(_self.copyWith(profile: value));
  });
}
}

// dart format on

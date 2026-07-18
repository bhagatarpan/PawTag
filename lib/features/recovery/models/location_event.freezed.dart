// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'location_event.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$LocationEvent {

 String get timestamp; double get latitude; double get longitude; String get source;
/// Create a copy of LocationEvent
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$LocationEventCopyWith<LocationEvent> get copyWith => _$LocationEventCopyWithImpl<LocationEvent>(this as LocationEvent, _$identity);

  /// Serializes this LocationEvent to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is LocationEvent&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp)&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.source, source) || other.source == source));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,timestamp,latitude,longitude,source);

@override
String toString() {
  return 'LocationEvent(timestamp: $timestamp, latitude: $latitude, longitude: $longitude, source: $source)';
}


}

/// @nodoc
abstract mixin class $LocationEventCopyWith<$Res>  {
  factory $LocationEventCopyWith(LocationEvent value, $Res Function(LocationEvent) _then) = _$LocationEventCopyWithImpl;
@useResult
$Res call({
 String timestamp, double latitude, double longitude, String source
});




}
/// @nodoc
class _$LocationEventCopyWithImpl<$Res>
    implements $LocationEventCopyWith<$Res> {
  _$LocationEventCopyWithImpl(this._self, this._then);

  final LocationEvent _self;
  final $Res Function(LocationEvent) _then;

/// Create a copy of LocationEvent
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? timestamp = null,Object? latitude = null,Object? longitude = null,Object? source = null,}) {
  return _then(_self.copyWith(
timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,latitude: null == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double,longitude: null == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double,source: null == source ? _self.source : source // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [LocationEvent].
extension LocationEventPatterns on LocationEvent {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _LocationEvent value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _LocationEvent() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _LocationEvent value)  $default,){
final _that = this;
switch (_that) {
case _LocationEvent():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _LocationEvent value)?  $default,){
final _that = this;
switch (_that) {
case _LocationEvent() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String timestamp,  double latitude,  double longitude,  String source)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _LocationEvent() when $default != null:
return $default(_that.timestamp,_that.latitude,_that.longitude,_that.source);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String timestamp,  double latitude,  double longitude,  String source)  $default,) {final _that = this;
switch (_that) {
case _LocationEvent():
return $default(_that.timestamp,_that.latitude,_that.longitude,_that.source);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String timestamp,  double latitude,  double longitude,  String source)?  $default,) {final _that = this;
switch (_that) {
case _LocationEvent() when $default != null:
return $default(_that.timestamp,_that.latitude,_that.longitude,_that.source);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _LocationEvent implements LocationEvent {
  const _LocationEvent({required this.timestamp, required this.latitude, required this.longitude, required this.source});
  factory _LocationEvent.fromJson(Map<String, dynamic> json) => _$LocationEventFromJson(json);

@override final  String timestamp;
@override final  double latitude;
@override final  double longitude;
@override final  String source;

/// Create a copy of LocationEvent
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$LocationEventCopyWith<_LocationEvent> get copyWith => __$LocationEventCopyWithImpl<_LocationEvent>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$LocationEventToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _LocationEvent&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp)&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.source, source) || other.source == source));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,timestamp,latitude,longitude,source);

@override
String toString() {
  return 'LocationEvent(timestamp: $timestamp, latitude: $latitude, longitude: $longitude, source: $source)';
}


}

/// @nodoc
abstract mixin class _$LocationEventCopyWith<$Res> implements $LocationEventCopyWith<$Res> {
  factory _$LocationEventCopyWith(_LocationEvent value, $Res Function(_LocationEvent) _then) = __$LocationEventCopyWithImpl;
@override @useResult
$Res call({
 String timestamp, double latitude, double longitude, String source
});




}
/// @nodoc
class __$LocationEventCopyWithImpl<$Res>
    implements _$LocationEventCopyWith<$Res> {
  __$LocationEventCopyWithImpl(this._self, this._then);

  final _LocationEvent _self;
  final $Res Function(_LocationEvent) _then;

/// Create a copy of LocationEvent
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? timestamp = null,Object? latitude = null,Object? longitude = null,Object? source = null,}) {
  return _then(_LocationEvent(
timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,latitude: null == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double,longitude: null == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double,source: null == source ? _self.source : source // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on

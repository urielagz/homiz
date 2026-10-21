import 'package:intl/intl.dart';

/// Formatos de moneda y fecha en español de México.
abstract final class Fmt {
  static const _locale = 'es_MX';
  static final _money = NumberFormat.currency(locale: _locale, symbol: r'$', decimalDigits: 0);
  static final _moneyCents = NumberFormat.currency(locale: _locale, symbol: r'$', decimalDigits: 2);

  /// 12000 → "$12,000"; 1840.5 → "$1,840.50"
  static String money(num value) => (value % 1 == 0 ? _money : _moneyCents).format(value);

  /// Fechas de la API (AAAA-MM-DD o ISO). Las horas se muestran en la hora local del teléfono.
  static DateTime parse(String value) => value.length == 10 ? DateTime.parse('${value}T12:00:00') : DateTime.parse(value).toLocal();

  /// "5 de noviembre"
  static String dayMonth(DateTime d) => DateFormat("d 'de' MMMM", _locale).format(d);

  /// "5 nov"
  static String dayMonthShort(DateTime d) => DateFormat('d MMM', _locale).format(d).replaceAll('.', '');

  /// "15 de marzo de 1995"
  static String longDate(DateTime d) => DateFormat("d 'de' MMMM 'de' y", _locale).format(d);

  /// "30 jun 2027"
  static String shortDate(DateTime d) => DateFormat('d MMM y', _locale).format(d).replaceAll('.', '');

  /// "Jue - 16 Oct 5:00 pm"
  static String appointment(DateTime d) {
    final day = _cap(DateFormat('EEE', _locale).format(d).replaceAll('.', ''));
    final month = _cap(DateFormat('MMM', _locale).format(d).replaceAll('.', ''));
    return '$day - ${d.day} $month ${time(d)}';
  }

  /// "5:00 pm"
  static String time(DateTime d) {
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    return '$h:${d.minute.toString().padLeft(2, '0')} ${d.hour < 12 ? 'am' : 'pm'}';
  }

  /// Primer nombre para el saludo.
  static String firstName(String name) => name.trim().split(RegExp(r'\s+')).first;

  /// Iniciales para el avatar: "Laura Mendez" → "LM".
  static String initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }

  static String _cap(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}

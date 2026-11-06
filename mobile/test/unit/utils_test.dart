import 'package:flutter_test/flutter_test.dart';
import 'package:homiz/core/utils/formatters.dart';
import 'package:homiz/core/utils/validators.dart';
import 'package:homiz/features/requests/data/requests_repository.dart';
import 'package:intl/date_symbol_data_local.dart';

void main() {
  setUpAll(() => initializeDateFormatting('es_MX'));

  group('Validators', () {
    test('correo', () {
      expect(Validators.email(''), isNotNull);
      expect(Validators.email('laura@'), isNotNull);
      expect(Validators.email('lau.mendez@correo.com'), isNull);
    });

    test('teléfono de 10 dígitos', () {
      expect(Validators.phone('998 123 45'), isNotNull);
      expect(Validators.phone('998 123 4567'), isNull);
    });

    test('contraseña con la misma política que la API', () {
      expect(Validators.password('corta'), contains('al menos 8 caracteres'));
      expect(Validators.password('sinnumeros'), contains('un número'));
      expect(Validators.password('Zugar2026'), isNull);
    });

    test('seguridad de la contraseña de 0 a 5', () {
      expect(Validators.passwordStrength(''), 0);
      expect(Validators.passwordStrength('zugar2026'), 3);
      expect(Validators.passwordStrength('Zugar2026'), 4);
      expect(Validators.passwordStrength('Zugar2026!'), 5);
    });
  });

  group('Fmt', () {
    test('moneda en pesos', () {
      expect(Fmt.money(12000), r'$12,000');
      expect(Fmt.money(1840.5), r'$1,840.50');
    });

    test('fecha de cita', () {
      // Formato de 24 horas
      expect(Fmt.appointment(DateTime(2026, 10, 22, 17)), 'Jue - 22 Oct 5:00 p.m.');
      expect(Fmt.time(DateTime(2026, 1, 1, 0, 5)), '12:05 a.m.');
      expect(Fmt.time(DateTime(2026, 1, 1, 9, 30)), '9:30 a.m.');
    });

    test('fechas de la API sin corrimiento de día', () {
      expect(Fmt.longDate(Fmt.parse('1995-03-15')), '15 de marzo de 1995');
    });

    test('la cita de una solicitud sale en hora de Cancún, sin importar la zona del dispositivo', () {
      final a = RequestAppointment.fromJson({'id': '1', 'code': 'CIT-1', 'scheduledAt': '2026-11-13T08:00:00.000Z', 'status': 'por-confirmar'});
      expect(Fmt.appointment(a.scheduledAt), 'Vie - 13 Nov 3:00 a.m.');
    });

    test('nombre e iniciales', () {
      expect(Fmt.firstName('  Laura Méndez '), 'Laura');
      expect(Fmt.initials('laura méndez ruiz'), 'LM');
    });
  });
}

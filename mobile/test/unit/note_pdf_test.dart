import 'package:flutter_test/flutter_test.dart';
import 'package:homiz/features/payments/data/models/payment_models.dart';
import 'package:homiz/features/payments/presentation/widgets/payments_tab.dart';
import 'package:intl/date_symbol_data_local.dart';

import '../fixtures.dart';

/// El pagaré con PDF firmado lo indica en la lista del cliente; sin PDF, solo su estado.
void main() {
  setUpAll(() => initializeDateFormatting('es_MX'));

  test('Pagaré con PDF: «Pendiente · Pagaré en PDF»', () {
    final withPdf = PromissoryNote.fromJson({...note(6, '2026-12-05', 'pending'), 'documentId': 'doc-pagare-06'});
    expect(withPdf.documentId, 'doc-pagare-06');
    expect(NotesList.statusText(withPdf), 'Pendiente · Pagaré en PDF');
  });

  test('Pagaré sin PDF: solo su estado', () {
    final plain = PromissoryNote.fromJson(note(4, '2026-10-05', 'paid', proof: 'doc-n4'));
    expect(plain.documentId, isNull);
    expect(NotesList.statusText(plain), 'Comprobante');
  });
}

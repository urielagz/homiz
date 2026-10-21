// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'payment_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PromissoryNote _$PromissoryNoteFromJson(Map<String, dynamic> json) =>
    _PromissoryNote(
      id: json['id'] as String,
      number: (json['number'] as num).toInt(),
      label: json['label'] as String,
      amount: (json['amount'] as num).toDouble(),
      dueDate: const LocalDate().fromJson(json['dueDate'] as String),
      status: json['status'] as String,
      payment: json['payment'] == null
          ? null
          : NotePayment.fromJson(json['payment'] as Map<String, dynamic>),
      proofDocumentId: json['proofDocumentId'] as String?,
    );

Map<String, dynamic> _$PromissoryNoteToJson(_PromissoryNote instance) =>
    <String, dynamic>{
      'id': instance.id,
      'number': instance.number,
      'label': instance.label,
      'amount': instance.amount,
      'dueDate': const LocalDate().toJson(instance.dueDate),
      'status': instance.status,
      'payment': instance.payment,
      'proofDocumentId': instance.proofDocumentId,
    };

_NotePayment _$NotePaymentFromJson(Map<String, dynamic> json) => _NotePayment(
  id: json['id'] as String,
  amount: (json['amount'] as num).toDouble(),
  paidAt: const LocalDate().fromJson(json['paidAt'] as String),
  receiptFolio: json['receiptFolio'] as String?,
);

Map<String, dynamic> _$NotePaymentToJson(_NotePayment instance) =>
    <String, dynamic>{
      'id': instance.id,
      'amount': instance.amount,
      'paidAt': const LocalDate().toJson(instance.paidAt),
      'receiptFolio': instance.receiptFolio,
    };

_NotesSummary _$NotesSummaryFromJson(Map<String, dynamic> json) =>
    _NotesSummary(
      total: (json['total'] as num).toInt(),
      paid: (json['paid'] as num).toInt(),
      remaining: (json['remaining'] as num).toInt(),
      remainingAmount: (json['remainingAmount'] as num?)?.toDouble() ?? 0,
      next: json['next'] == null
          ? null
          : NextNote.fromJson(json['next'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$NotesSummaryToJson(_NotesSummary instance) =>
    <String, dynamic>{
      'total': instance.total,
      'paid': instance.paid,
      'remaining': instance.remaining,
      'remainingAmount': instance.remainingAmount,
      'next': instance.next,
    };

_NextNote _$NextNoteFromJson(Map<String, dynamic> json) => _NextNote(
  number: (json['number'] as num).toInt(),
  dueDate: const LocalDate().fromJson(json['dueDate'] as String),
  amount: (json['amount'] as num).toDouble(),
);

Map<String, dynamic> _$NextNoteToJson(_NextNote instance) => <String, dynamic>{
  'number': instance.number,
  'dueDate': const LocalDate().toJson(instance.dueDate),
  'amount': instance.amount,
};

_Receipt _$ReceiptFromJson(Map<String, dynamic> json) => _Receipt(
  id: json['id'] as String,
  kind: json['kind'] as String,
  concept: json['concept'] as String,
  periodLabel: json['periodLabel'] as String?,
  amount: (json['amount'] as num).toDouble(),
  dueDate: const LocalDateOrNull().fromJson(json['dueDate'] as String?),
  paidAt: const LocalDateOrNull().fromJson(json['paidAt'] as String?),
  status: json['status'] as String,
  documentId: json['documentId'] as String?,
);

Map<String, dynamic> _$ReceiptToJson(_Receipt instance) => <String, dynamic>{
  'id': instance.id,
  'kind': instance.kind,
  'concept': instance.concept,
  'periodLabel': instance.periodLabel,
  'amount': instance.amount,
  'dueDate': const LocalDateOrNull().toJson(instance.dueDate),
  'paidAt': const LocalDateOrNull().toJson(instance.paidAt),
  'status': instance.status,
  'documentId': instance.documentId,
};

CREATE POLICY "statement receipts read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'statement-receipts');
CREATE POLICY "statement receipts insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'statement-receipts');
CREATE POLICY "statement receipts update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'statement-receipts') WITH CHECK (bucket_id = 'statement-receipts');
CREATE POLICY "statement receipts delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'statement-receipts');
"""Focused image handling tests."""

from unittest.mock import MagicMock

from app import (
    _extract_image_urls_from_payload,
    _extract_uploaded_images_as_data_urls,
    _normalize_http_image_url,
)


class TestNormalizeImageUrl:
    def test_accepts_http_and_https(self):
        assert _normalize_http_image_url('http://example.com/a.jpg') == 'http://example.com/a.jpg'
        assert _normalize_http_image_url('https://example.com/a.jpg') == 'https://example.com/a.jpg'

    def test_rejects_non_http_urls(self):
        assert _normalize_http_image_url('data:image/png;base64,abc') is None
        assert _normalize_http_image_url('file:///tmp/a.jpg') is None
        assert _normalize_http_image_url('/images/a.jpg') is None


class TestExtractImageUrls:
    def test_parses_and_deduplicates_urls(self):
        payload = {'images': 'https://example.com/1.jpg, https://example.com/1.jpg\nhttps://example.com/2.jpg'}
        result = _extract_image_urls_from_payload(payload)
        assert result == ['https://example.com/1.jpg', 'https://example.com/2.jpg']

    def test_filters_invalid_candidates(self):
        payload = {'images': ['https://example.com/ok.jpg', 'data:image/png;base64,abc']}
        result = _extract_image_urls_from_payload(payload)
        assert result == ['https://example.com/ok.jpg']


class TestUploadedImages:
    def test_converts_uploaded_images_to_data_urls(self):
        image = MagicMock()
        image.filename = 'photo.jpg'
        image.mimetype = 'image/jpeg'
        image.read.return_value = b'image-bytes'

        result = _extract_uploaded_images_as_data_urls([image])
        assert len(result) == 1
        assert result[0].startswith('data:image/jpeg;base64,')

    def test_skips_non_image_or_empty_files(self):
        not_image = MagicMock()
        not_image.filename = 'doc.pdf'
        not_image.mimetype = 'application/pdf'
        not_image.read.return_value = b'bytes'

        empty_image = MagicMock()
        empty_image.filename = 'empty.jpg'
        empty_image.mimetype = 'image/jpeg'
        empty_image.read.return_value = b''

        result = _extract_uploaded_images_as_data_urls([not_image, empty_image, None])
        assert result == []

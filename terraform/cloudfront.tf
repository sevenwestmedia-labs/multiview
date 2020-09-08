resource "aws_cloudfront_distribution" "distribution" {
  origin {
    domain_name = aws_alb.alb.dns_name
    origin_id   = "load-balancer"

    custom_origin_config {
      http_port              = "80"
      https_port             = "443"
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1", "TLSv1.1", "TLSv1.2"]
    }
  }

  enabled         = true
  is_ipv6_enabled = true
  //aliases = [var.domain_name]

  custom_error_response {
    error_caching_min_ttl = 0
    error_code            = "404"
  }

  custom_error_response {
    error_caching_min_ttl = 0
    error_code            = "503"
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "load-balancer"

    forwarded_values {
      query_string            = true
      query_string_cache_keys = ["urls"]

      cookies {
        forward = "none"
      }
    }

    min_ttl                = 0
    default_ttl            = 1
    max_ttl                = 86400
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
  }

  price_class = "PriceClass_All"

  /*
  restrictions {
    geo_restriction {
      restriction_type = "whitelist"
      locations        = ["AU"]
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = false
    acm_certificate_arn = var.cloudfront_acm_cert_arn
    ssl_support_method = "sni-only"
  }*/

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

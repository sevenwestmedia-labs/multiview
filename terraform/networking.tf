resource "aws_security_group" "allow_internal_traffic" {
  name        = "allow_internal_traffic"
  description = "Allows interal traffic"
  vpc_id      = var.vpc
  ingress {
    protocol  = "-1"
    from_port = 0
    to_port   = 0
    self      = true
  }
  egress {
    protocol  = "-1"
    from_port = 0
    to_port   = 0
    self      = true
  }
  tags = {
    Stack = "Multiview"
  }
}

resource "aws_security_group" "allow_http_outbound" {
  name        = "allow_http_outbound"
  description = "Allows HTTP/HTTPS connections outbound"
  vpc_id      = var.vpc
  egress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Stack = "Multiview"
  }
}

resource "aws_security_group" "allow_public_http_inbound" {
  name        = "allow_public_http_inbound"
  description = "Allows HTTP/HTTPS connections inbound"
  vpc_id      = var.vpc
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Stack = "Multiview"
  }
}

resource "aws_security_group" "load_balancer" {
  name        = "multiview_load_balancer"
  description = "Allows HTTP/HTTPS connections inbound"
  vpc_id      = var.vpc
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Stack = "Multiview"
  }
}

resource "aws_security_group" "load_balancer_target" {
  name        = "multiview_load_balancer_target"
  description = "Allows HTTP from load balancer"
  vpc_id      = var.vpc

  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.load_balancer.id]
  }
  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.load_balancer.id]
  }

  tags = {
    Stack = "Multiview"
  }
}

resource "aws_alb" "alb" {
  name            = "multiview-load-balancer"
  security_groups = [aws_security_group.load_balancer.id,aws_security_group.allow_http_outbound.id]
  subnets         = data.aws_subnet_ids.subnets.ids

  tags = {
    Stack = "Multiview"
  }
}


resource "aws_alb_listener" "front_end" {
  load_balancer_arn = aws_alb.alb.id
  port              = "80"
  protocol          = "HTTP"

  default_action {
    target_group_arn = aws_alb_target_group.manager.id
    type             = "forward"
  }
}

resource "aws_alb_target_group" "manager" {
  name        = "multiview-manager"
  target_type = "ip"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = var.vpc
  depends_on = [aws_alb.alb]
}

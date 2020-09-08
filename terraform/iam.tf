resource "aws_iam_role" "multiview_ecs_execution_role" {
  name = "multiview_ecs_execution_role"
  
  assume_role_policy = <<-EOF
  {
    "Version": "2012-10-17",
    "Statement": [{
      "Sid": "",
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }]
  }
  EOF

  tags = {
    Stack = "Multiview"
  }
}

resource "aws_iam_role_policy" "multiview_ecs_execution_role_policy" {
  name   = "multiview_ecs_execution_role_policy"
  role   = aws_iam_role.multiview_ecs_execution_role.id

  policy = <<-EOF
  {
    "Version": "2012-10-17",
    "Statement": [{
        "Sid": "VisualEditor0",
        "Effect": "Allow",
        "Action": [
          "ecr:DescribeImageScanFindings",
          "ecr:GetLifecyclePolicyPreview",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:DescribeImages",
          "ecr:DescribeRepositories",
          "ecr:ListTagsForResource",
          "ecr:ListImages",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetLifecyclePolicy",
          "ecr:GetRepositoryPolicy"
        ],
        "Resource": "arn:aws:ecr:ap-southeast-2:*:repository/*"
      },
      {
        "Sid": "VisualEditor1",
        "Effect": "Allow",
        "Action": "ecr:GetAuthorizationToken",
        "Resource": "*"
      },
      {
        "Effect": "Allow",
        "Action": [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "cloudwatch:PutMetricData"
        ],
        "Resource": "*"
      }
    ]
  }
  EOF
}

resource "aws_iam_role" "multiview_ecs_task_role" {
  name = "multiview_backend_ecs_task_role"
  
  assume_role_policy = <<-EOF
  {
    "Version": "2012-10-17",
    "Statement": [{
      "Sid": "",
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }]
  }
  EOF

  tags = {
    Stack = "Multiview"
  }
}

resource "aws_iam_role_policy" "multiview_ecs_task_role_policy" {
  name   = "multiview_ecs_task_role_policy"
  role   = aws_iam_role.multiview_ecs_task_role.id

  policy = <<-EOF
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "cloudwatch:PutMetricData",
          "ecs:UpdateService"
        ],
        "Resource": "*"
      },
      {
        "Effect": "Allow",
        "Action": [
          "dynamodb:PutItem",
          "dynamodb:GetItem"
        ],
        "Resource": "${aws_dynamodb_table.table.arn}"
      }
    ]
  }
  EOF
}


resource "aws_iam_role" "ecs_scaling_role" {
  name = "ecs_scaling_role"
  
  assume_role_policy = <<-EOF
  {
    "Version": "2012-10-17",
    "Statement": [{
      "Sid": "",
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }]
  }
  EOF

  tags = {
    Stack = "Multiview"
  }
}

resource "aws_iam_role_policy" "ecs_scaling_role_policy" {
  name   = "ecs_scaling_role_policy"
  role   = aws_iam_role.ecs_scaling_role.id

  policy = <<-EOF
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "ecs:UpdateService"
        ],
        "Resource": "*"
      }
    ]
  }
  EOF
}

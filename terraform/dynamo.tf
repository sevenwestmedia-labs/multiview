resource "aws_dynamodb_table" "table" {
  name           = "MultiviewConfig"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "streamKey"

  attribute {
    name = "streamKey"
    type = "S"
  }

  tags = {
    Stack = "Multiview"
  }
}
import { Input, HStack, Box } from "@chakra-ui/react"
import { Image } from "@chakra-ui/react";
import { useState } from "react"

const Demo = () => {
  const [image, setImage] = useState<File | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };
  
  return (
    <Box display={"flex"} justifyContent={"center"} flexDirection={"column"} alignItems={"center"} w={"100%"} mt={10}>
      <HStack justify={"center"}>
        <Input type="file" accept="image/*" onChange={handleImageChange} />
      </HStack>
      {image && (
        <Image
          src={URL.createObjectURL(image)}
          alt="preview"
          className="mt-4 w-64 h-64 object-cover rounded-lg shadow-md"
          mt={4}
          maxW={"256px"}
          maxH={"256px"}
          objectFit="cover"
          borderRadius="lg"
          boxShadow="md"
        />
      )}
    </Box>
  )
}

export default Demo
